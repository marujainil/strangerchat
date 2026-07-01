import type { Metadata, Viewport } from 'next';
import { Sora, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const display = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'StrangerChat — Talk to Strangers, Instantly',
    template: '%s · StrangerChat',
  },
  description:
    'StrangerChat is a modern, anonymous video, audio and text chat platform. Meet new people from around the world instantly — no sign-up required. Premium filters for country, gender, interests and more.',
  keywords: [
    'random video chat',
    'talk to strangers',
    'anonymous chat',
    'omegle alternative',
    'video chat with strangers',
    'meet new people',
    'cam chat',
    'random call',
  ],
  authors: [{ name: 'StrangerChat' }],
  creator: 'StrangerChat',
  applicationName: 'StrangerChat',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'StrangerChat',
    title: 'StrangerChat — Talk to Strangers, Instantly',
    description:
      'Anonymous video, audio and text chat with strangers worldwide. No sign-up. Premium filters available.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'StrangerChat',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StrangerChat — Talk to Strangers, Instantly',
    description:
      'Anonymous video, audio and text chat with strangers worldwide. No sign-up. Premium filters available.',
    images: ['/og.png'],
    creator: '@strangerchat',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  category: 'social',
};

export const viewport: Viewport = {
  themeColor: '#08080c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'StrangerChat',
  url: SITE_URL,
  applicationCategory: 'SocialNetworkingApplication',
  operatingSystem: 'Web',
  description:
    'Modern anonymous video, audio and text chat with strangers worldwide.',
  offers: [
    { '@type': 'Offer', name: 'Monthly Premium', price: '69', priceCurrency: 'INR' },
    { '@type': 'Offer', name: '6 Months Premium', price: '299', priceCurrency: 'INR' },
    { '@type': 'Offer', name: 'Yearly Premium', price: '699', priceCurrency: 'INR' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
