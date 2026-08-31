import type { MetadataRoute } from 'next';

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: marketingUrl, changeFrequency: 'monthly', priority: 1 },
    {
      url: `${marketingUrl}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
