#!/usr/bin/env node
/**
 * Keeps public/images fast and tidy.
 *
 *   npm run images          convert every raster image to WebP (same width and
 *                           height), remove the original, report duplicates
 *   npm run images:check    change nothing; exit 1 if anything needs fixing
 *                           (run in CI)
 *
 * Rules (see public/images/README.md):
 *   - images live in a folder named after the page that uses them
 *     (home/, pricing/, blog/, auth/, brand/) — never loose in images/
 *   - raster images are WebP; SVG is fine as-is
 *   - the same image is never stored twice (compared by content hash)
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/images');
const check = process.argv.includes('--check');
const RASTER = new Set(['.png', '.jpg', '.jpeg', '.gif', '.tif', '.tiff', '.avif', '.heic']);
const QUALITY = Number(process.env.MEDIA_WEBP_QUALITY ?? 90);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const problems = [];
const hashes = new Map();

for await (const file of walk(root)) {
  const rel = path.relative(root, file);
  const ext = path.extname(file).toLowerCase();
  if (rel.toLowerCase() === 'readme.md' || path.basename(file).startsWith('.')) continue;

  if (!rel.includes(path.sep)) problems.push(`${rel}: move into a page folder (e.g. home/${rel})`);

  let target = file;
  if (RASTER.has(ext)) {
    if (check) {
      problems.push(`${rel}: not WebP — run "npm run images"`);
    } else {
      const meta = await sharp(file).metadata();
      const out = file.slice(0, -ext.length) + '.webp';
      const lossless = !!meta.hasAlpha && ext !== '.jpg' && ext !== '.jpeg';
      await sharp(file)
        .rotate()
        .webp(
          lossless
            ? { lossless: true, effort: 6 }
            : { quality: QUALITY, effort: 6, smartSubsample: true },
        )
        .toFile(out);
      const [before, after] = await Promise.all([stat(file), stat(out)]);
      await rm(file);
      console.log(
        `✓ ${rel} → ${path.relative(root, out)} (${meta.width}×${meta.height}, ${Math.round(before.size / 1024)} KB → ${Math.round(after.size / 1024)} KB)`,
      );
      target = out;
    }
  }

  const hash = createHash('sha256')
    .update(await readFile(target))
    .digest('hex');
  const existing = hashes.get(hash);
  if (existing)
    problems.push(
      `${path.relative(root, target)}: duplicate of ${existing} — reference one file and delete the other`,
    );
  else hashes.set(hash, path.relative(root, target));
}

if (problems.length) {
  console.error(`\n${problems.length} image issue(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(check ? 1 : 0);
}
console.log(`public/images is clean (${hashes.size} files).`);
