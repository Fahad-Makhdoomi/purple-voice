'use client';

import { useRef, useState } from 'react';
import { Copy, ImagePlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, Modal, Pagination, toast, useAction } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface MediaAsset {
  id: string;
  folder: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSize: number;
  alt: string;
  createdAt: string;
}

const kb = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

/**
 * The media library. Every upload is converted to WebP at full resolution
 * on the server and de-duplicated by content, and lives in a folder named
 * after the page or post that uses it (pages/home, blog/<slug>, brand).
 */
export function MediaLibrary({
  onPick,
  defaultFolder = 'general',
}: {
  onPick?: (asset: MediaAsset) => void;
  defaultFolder?: string;
}) {
  const [folder, setFolder] = useState('');
  const [uploadFolder, setUploadFolder] = useState(defaultFolder);
  const [page, setPage] = useState(1);
  const { data, reload } = useApi<{
    assets: MediaAsset[];
    total: number;
    page: number;
    pageSize: number;
    folders: Array<{ folder: string; count: number }>;
  }>(
    `/admin/cms/media?page=${page}&pageSize=24${folder ? `&folder=${encodeURIComponent(folder)}` : ''}`,
  );
  const input = useRef<HTMLInputElement>(null);
  const { busy, run } = useAction();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const body = new FormData();
    Array.from(files).forEach((f) => body.append('files', f));
    body.append('folder', uploadFolder);
    await run(async () => {
      const r = await api<{ results: Array<{ asset: MediaAsset; duplicate: boolean }> }>(
        '/admin/cms/media',
        { body },
      );
      const dupes = r.results.filter((x) => x.duplicate).length;
      toast(
        dupes
          ? `${r.results.length - dupes} uploaded, ${dupes} already in the library (reused)`
          : `${r.results.length} image(s) uploaded as WebP`,
      );
      await reload();
      if (onPick && r.results.length === 1) onPick(r.results[0].asset);
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[180px]">
          <span className="label">Show folder</span>
          <select
            className="select"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All folders</option>
            {data?.folders.map((f) => (
              <option key={f.folder} value={f.folder}>
                {f.folder} ({f.count})
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="label">Upload into folder</span>
          <input
            className="input font-mono"
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value)}
            placeholder="pages/home"
          />
        </label>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
          aria-label="Upload images"
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={16} aria-hidden="true" /> {busy ? 'Converting…' : 'Upload images'}
        </button>
      </div>
      <p className="mb-4 text-xs text-muted">
        Images are converted to WebP at their original resolution. Uploading an image that already
        exists reuses it instead of creating a copy.
      </p>
      {!data ? (
        <Loading />
      ) : data.assets.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No images in this folder yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.assets.map((a) => (
            <li
              key={a.id}
              className="group overflow-hidden rounded-lg border border-line bg-surface"
            >
              <button
                type="button"
                className={cn('block aspect-[4/3] w-full bg-canvas', onPick && 'cursor-pointer')}
                onClick={() => onPick?.(a)}
                aria-label={onPick ? `Use ${a.filename}` : a.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="p-2.5 text-xs">
                <p className="truncate font-mono font-semibold" title={`${a.folder}/${a.filename}`}>
                  {a.folder}/{a.filename}
                </p>
                <p className="text-muted">
                  {a.width}×{a.height} · {kb(a.sizeBytes)}{' '}
                  <span className="text-success">(was {kb(a.originalSize)})</span>
                </p>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm h-7 px-2"
                    onClick={() =>
                      void navigator.clipboard.writeText(a.url).then(() => toast('URL copied'))
                    }
                  >
                    <Copy size={12} aria-hidden="true" /> URL
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm h-7 px-2"
                    onClick={() => {
                      const alt = window.prompt(
                        'Alt text (describe the image for screen readers and SEO)',
                        a.alt,
                      );
                      if (alt !== null)
                        void run(async () => {
                          await api(`/admin/cms/media/${a.id}`, { method: 'PATCH', body: { alt } });
                          await reload();
                        }, 'Alt text saved');
                    }}
                  >
                    Alt
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm ml-auto h-7 px-2 text-danger"
                    aria-label="Delete image"
                    onClick={() =>
                      window.confirm('Delete this image?') &&
                      void run(async () => {
                        await api(`/admin/cms/media/${a.id}`, { method: 'DELETE' });
                        await reload();
                      }, 'Image deleted')
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
      )}
    </div>
  );
}

export function MediaPickerModal({
  open,
  onClose,
  onPick,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (a: MediaAsset) => void;
  folder: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Choose an image" size="lg">
      {open && (
        <MediaLibrary
          defaultFolder={folder}
          onPick={(a) => {
            onPick(a);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
