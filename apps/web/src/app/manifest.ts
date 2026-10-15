import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Purple Voice',
    short_name: 'Purple Voice',
    description: 'AI voice agents for sales calls',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#07060c',
    theme_color: '#6236f0',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
