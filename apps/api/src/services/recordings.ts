import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getEntitlements } from './entitlements';

/**
 * Call recordings. Unlike uploaded media they are private: never under the
 * public /uploads directory or behind a public URL. Local disk keeps them in
 * RECORDINGS_LOCAL_PATH (not served by nginx); S3 keeps them under
 * `recordings/` and reads them back with the API's own credentials. Only the
 * API streams them, to people signed in to the call's workspace.
 *
 * `Call.recordingUrl` holds the storage key, e.g. `<workspaceId>/<callId>-<random>.wav`.
 */

const S3_PREFIX = 'recordings/';

interface RecordingStore {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  removeWorkspace(workspaceId: string): Promise<void>;
}

class LocalRecordings implements RecordingStore {
  private readonly root = path.resolve(process.cwd(), env.RECORDINGS_LOCAL_PATH);

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error('Invalid recording key');
    return target;
  }

  async put(key: string, body: Buffer) {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, { mode: 0o600 });
  }

  async get(key: string) {
    return fs.readFile(this.resolve(key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });
  }

  async removeWorkspace(workspaceId: string) {
    await fs.rm(this.resolve(workspaceId), { recursive: true, force: true });
  }
}

class S3Recordings implements RecordingStore {
  private readonly client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });

  async put(key: string, body: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: S3_PREFIX + key,
        Body: body,
        ContentType: 'audio/wav',
        CacheControl: 'private, no-store',
      }),
    );
  }

  async get(key: string) {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: S3_PREFIX + key }),
      );
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    } catch (err) {
      if ((err as { name?: string }).name === 'NoSuchKey') return null;
      throw err;
    }
  }

  async removeWorkspace(workspaceId: string) {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: env.S3_BUCKET,
          Prefix: `${S3_PREFIX}${workspaceId}/`,
          ContinuationToken: token,
        }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (keys.length) {
        await this.client.send(
          new DeleteObjectsCommand({ Bucket: env.S3_BUCKET, Delete: { Objects: keys } }),
        );
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}

const store: RecordingStore =
  env.STORAGE_DRIVER === 's3' ? new S3Recordings() : new LocalRecordings();

/** Calls are recorded when the workspace's plan includes call recording (Pro and up). */
export async function recordsCalls(workspaceId: string): Promise<boolean> {
  return (await getEntitlements(workspaceId)).features.callRecording === true;
}

/** Stores a finished call's recording and links it to the call. Never throws. */
export async function saveRecording(callId: string, wav: Buffer | null): Promise<void> {
  if (!wav) return;
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { workspaceId: true },
    });
    if (!call) return;
    const key = `${call.workspaceId}/${callId}-${randomBytes(8).toString('hex')}.wav`;
    await store.put(key, wav);
    await prisma.call.update({ where: { id: callId }, data: { recordingUrl: key } });
  } catch (err) {
    logger.error({ err, callId }, 'Could not save call recording');
  }
}

export async function readRecording(key: string): Promise<Buffer | null> {
  return store.get(key);
}

/** Deletes every recording of a workspace (account deletion). */
export async function deleteWorkspaceRecordings(workspaceId: string): Promise<void> {
  await store.removeWorkspace(workspaceId);
}
