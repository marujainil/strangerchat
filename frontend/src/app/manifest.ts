import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StrangerChat — Talk to Strangers',
    short_name: 'StrangerChat',
    description:
      'Free anonymous video, audio and text chat with random people around the world.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080c',
    theme_color: '#7c3aed',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    categories: ['social', 'communication'],
  };
}
