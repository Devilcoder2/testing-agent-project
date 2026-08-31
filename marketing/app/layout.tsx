import type { Metadata } from 'next';
import '@fontsource-variable/geist';
import '@fontsource-variable/ibm-plex-sans';
import '../tokens.css';
import './globals.css';

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(marketingUrl),
  title: 'Sentinel — Know before you ship.',
  description:
    'Teach Sentinel a browser journey once. Replay it safely and review the evidence before a human release decision.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Sentinel — Know before you ship.',
    description:
      'Human-taught browser journeys, safe replay, and evidence for a human release decision.',
    type: 'website',
    url: '/',
    siteName: 'Sentinel',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Sentinel showing a real sanitized product workspace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sentinel — Know before you ship.',
    description:
      'Human-taught browser journeys, safe replay, and evidence for a human release decision.',
    images: ['/og.png'],
  },
  icons: { icon: '/favicon.svg' },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sentinel',
  url: marketingUrl,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description:
    'QA automation for human-taught browser journeys, safe autonomous replay, complete evidence, and human-controlled release decisions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-impeccable-direction="b90708d6">
        <template
          id="impeccable-direction-contract"
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: Sentinel makes a release knowable by returning a real browser journey with its evidence; the product carries the proof and the page stays quiet.
OWN-WORLD: Near-white product cinema, near-black Geist statements, IBM Plex Sans support, restrained cobalt action, generous visual pauses, and real Sentinel captures.
STORY: A QA lead understands the promise, sees the real workspace, follows Teach to Replay to Decide, learns where autonomy stops, then applies for the pilot.
FIRST VIEWPORT: A minimal header and short centered promise sit in generous white space; one real Sentinel workspace rises into the lower viewport as the dominant object.
FORM: Quiet Flight is the owner-pinned reference-derived direction; seed b90708d6, approved comp quiet-flight-c.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`,
          }}
        />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
