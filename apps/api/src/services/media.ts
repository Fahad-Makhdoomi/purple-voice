import sharp from 'sharp';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { sha256 } from '../lib/crypto';
import { badRequest } from '../lib/http-error';
import { storage } from './storage';

/**
 * Image pipeline for every upload (CMS pages, blog covers, brand assets):
 *
 *  1. Reject anything that isn't a decodable raster image.
 *  2. Hash the uploaded bytes; if we've seen them, return the existing asset.
 *  3. Convert to WebP at the original width and height — never resized.
 *     Photos use MEDIA_WEBP_QUALITY; images with transparency (logos,
 *     illustrations) are encoded losslessly so edges stay crisp.
 *  4. Hash the WebP output too; a different file that encodes to identical
 *     pixels is still a duplicate.
 *  5. Store under <folder>/<name>-<hash>.webp, one folder per page or post.
 *
 * Metadata (EXIF, GPS) is stripped; orientation is applied first so the
 * stored pixels display the right way up.
 */

const ACCEPTED_INPUT = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif']);
// sharp refuses images above this many pixels by default; keep it explicit.
const MAX_PIXELS = 100_000_000;

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  folder: string;
  alt?: string;
  uploadedById?: string;
}

export function normaliseFolder(folder: string | undefined): string {
  const clean = (folder ?? 'general')
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^[-/]+|[-/]+$/g, '');
  return clean || 'general';
}

function baseName(originalName: string): string {
  const stem = originalName.replace(/\.[^.]+$/, '');
  return (
    stem
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  );
}

export async function uploadImage(input: UploadInput) {
  if (input.buffer.length > env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024) {
    throw badRequest(`Images must be under ${env.MEDIA_MAX_UPLOAD_MB} MB`);
  }

  const sourceHash = sha256(input.buffer);
  const existingBySource = await prisma.mediaAsset.findUnique({ where: { sourceHash } });
  if (existingBySource) return { asset: existingBySource, duplicate: true };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input.buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw badRequest('That file is not an image we can read');
  }
  if (!meta.format || !ACCEPTED_INPUT.has(meta.format)) {
    throw badRequest('Upload a JPEG, PNG, WebP, GIF, AVIF, TIFF or HEIC image');
  }

  const encode = (options: sharp.WebpOptions) =>
    sharp(input.buffer, { limitInputPixels: MAX_PIXELS, animated: meta.format === 'gif' })
      .rotate()
      .webp({ effort: 5, ...options })
      .toBuffer({ resolveWithObject: true });

  // Photos (JPEG) encode lossy. Graphics with transparency encode lossless so edges
  // stay crisp. Other sources (PNG screenshots, illustrations) try both and keep
  // whichever file is smaller — both are full resolution.
  const lossy = () => encode({ quality: env.MEDIA_WEBP_QUALITY, smartSubsample: true });
  const lossless = () => encode({ lossless: true });
  let result;
  if (meta.format === 'jpeg') result = await lossy();
  else if (meta.hasAlpha) result = await lossless();
  else {
    const [a, b] = await Promise.all([lossy(), lossless()]);
    result = a.data.length <= b.data.length ? a : b;
  }
  const { data, info } = result;

  const contentHash = sha256(data);
  const existingByContent = await prisma.mediaAsset.findUnique({ where: { contentHash } });
  if (existingByContent) return { asset: existingByContent, duplicate: true };

  const folder = normaliseFolder(input.folder);
  const filename = `${baseName(input.originalName)}-${contentHash.slice(0, 10)}.webp`;
  const storageKey = `${folder}/${filename}`;
  await storage.put(storageKey, data, 'image/webp');

  const asset = await prisma.mediaAsset.create({
    data: {
      folder,
      filename,
      storageKey,
      url: storage.publicUrl(storageKey),
      width: info.width,
      height: info.height,
      sizeBytes: data.length,
      originalName: input.originalName.slice(0, 255),
      originalSize: input.buffer.length,
      sourceHash,
      contentHash,
      alt: input.alt ?? '',
      uploadedById: input.uploadedById,
    },
  });
  return { asset, duplicate: false };
}

export async function deleteImage(id: string) {
  const asset = await prisma.mediaAsset.delete({ where: { id } });
  await storage.remove(asset.storageKey);
  return asset;
}
