import type { MetadataRoute } from 'next';

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3000';
const isIndexable = process.env.NEXT_PUBLIC_MARKETING_INDEXABLE === 'true';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isIndexable
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' },
    sitemap: `${marketingUrl}/sitemap.xml`,
  };
}
