import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/structured-data';

/**
 * There was no robots.txt at all: the path answered 404 through the catch-all route, so every
 * crawler was free to take whatever it found. It says two different things now.
 *
 * While `SITE_LOCKED` is set, it refuses everything, which together with the 503 the curtain returns
 * (see lib/site-lock.ts) is the pair of signals that keeps an unfinished site out of an index rather
 * than merely asking politely.
 *
 * Once the curtain lifts it allows the site and keeps crawlers out of the admin and the API, neither
 * of which has a public page worth reaching. Read per request rather than baked into the build, so a
 * redeploy that reuses a cached build can never leave robots.txt saying the opposite of the curtain.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_LOCKED === 'true') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
