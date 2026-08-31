import type { Metadata } from 'next';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/antonio/700.css';
import '../tokens.css';
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
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Sentinel Release Proof showing a real product evidence stage',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sentinel — Teach the test once. Trust every release.',
    description:
      'Human-taught browser journeys, safe autonomous replay, and evidence your release team can act on.',
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
      <body data-impeccable-direction="d047e3e3">
        <template
          id="impeccable-direction-contract"
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: Sentinel is a release dossier assembled from real browser evidence; it refuses the generic SaaS hero, card grid, and sitemap footer.
OWN-WORLD: Ultramarine proof fields, chartreuse signal traces, cool registration paper, near-black evidence plates, condensed Antonio statements, and square technical rules.
STORY: A QA lead sees a taught journey become a safe replay, reads the attached evidence, keeps the human release call, then applies for the pilot.
FIRST VIEWPORT: Wordmark and statement occupy the upper blue field; a real Sentinel capture dominates the lower proof plate; a trace crosses the bottom into the chartreuse pilot action and paper registration band.
FORM: Release Proof was the first-ranked grounded form and the assigned seventh direction; seed d047e3e3, approved comp release-proof-b.
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
