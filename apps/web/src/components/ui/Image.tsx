import NextImage, { type ImageProps } from 'next/image';

/**
 * next/image, except images on hosts the optimizer doesn't accept (anything
 * but this site and NEXT_PUBLIC_IMAGE_HOSTS; see next.config.mjs) are shown
 * as they are instead of failing. Use this for any CMS or user-supplied src.
 */
const site = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').hostname;
  } catch {
    return 'localhost';
  }
})();
const hosts = new Set(
  [site, 'localhost', ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? '').split(',')]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

export function optimisable(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return true; // a static import
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  try {
    return hosts.has(new URL(src).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export default function Image(props: ImageProps) {
  return <NextImage {...props} unoptimized={props.unoptimized || !optimisable(props.src)} />;
}
