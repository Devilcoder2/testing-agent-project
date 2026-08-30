import type { Metadata } from 'next';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-serif-4';
import './globals.css';

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(marketingUrl),
  title: 'Sentinel — Teach the test once. Trust every release.',
  description:
    'Turn the browser journeys your team already knows into repeatable runs, complete evidence, and clear release decisions.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Sentinel — Teach the test once. Trust every release.',
    description:
      'Human-taught browser journeys, safe autonomous replay, and evidence your release team can act on.',
    type: 'website',
    url: '/',
    siteName: 'Sentinel',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sentinel — Teach the test once. Trust every release.',
    description:
      'Human-taught browser journeys, safe autonomous replay, and evidence your release team can act on.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
