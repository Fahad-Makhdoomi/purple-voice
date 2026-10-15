import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';

/**
 * Where uploaded files live. `local` writes under STORAGE_LOCAL_PATH and
 * nginx serves that directory at /uploads with long cache headers; `s3`
 * targets any S3-compatible bucket (Cloudflare R2, AWS S3, Backblaze B2).
 * Callers only ever see a storage key and a public URL, so switching driver
 * is a configuration change.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';

class LocalStorage implements StorageDriver {
  private readonly root = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    // Keys are generated server-side, but never let one escape the root.
    if (!target.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return target;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, { flag: 'wx' }).catch(async (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EEXIST') throw err;
    });
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${env.storagePublicUrl}/${key}`;
  }
}

class S3Storage implements StorageDriver {
  private readonly client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMMUTABLE,
      }),
    );
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }

  publicUrl(key: string): string {
    return `${env.storagePublicUrl}/${key}`;
  }
}

export const storage: StorageDriver =
  env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
