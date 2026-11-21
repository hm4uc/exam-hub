import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/gv', '/admin', '/api', '/doi-mat-khau'],
      },
    ],
  };
}
