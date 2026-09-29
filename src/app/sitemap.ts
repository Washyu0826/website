import type { MetadataRoute } from 'next';
import { listProjects } from '@/lib/db/projects';
import { listPosts } from '@/lib/db/posts';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/structured-data';

/**
 * There was no sitemap: `/sitemap.xml` answered 404 through the catch-all route, and the README had
 * been claiming one existed for some time.
 *
 * Every page exists twice, once per locale, and the two are the same page in different words rather
 * than two different pages. So each entry carries the other as a `languages` alternate, which is how
 * a crawler is told to treat them as one thing and serve the right one, instead of picking a winner
 * and dropping the other as duplicate content.
 *
 * `lastModified` comes from the row the page is built from, never from the clock: a sitemap that
 * claims everything changed today teaches a crawler to stop believing the field.
 *
 * Read per request rather than baked into the build, for the same reason robots.txt is: the site is
 * closed behind `SITE_LOCKED` until its content is finished, and while it is closed the sitemap
 * offers nothing. A redeploy on a cached build would otherwise leave the two contradicting.
 */
export const dynamic = 'force-dynamic';

const locales = routing.locales;

/** One entry per path, with the other locale attached as its alternate. */
function entry(path: string, lastModified?: string | null, priority = 0.5): MetadataRoute.Sitemap[number] {
  const url = absoluteUrl(`/${locales[0]}${path}`);
  return {
    url,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority,
    alternates: {
      languages: Object.fromEntries(
        locales.map(locale => [locale === 'zh' ? 'zh-Hant' : locale, absoluteUrl(`/${locale}${path}`)]),
      ),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.SITE_LOCKED === 'true') return [];

  const [projects, posts] = await Promise.all([listProjects(), listPosts({ limit: 50 })]);
  const newest = (rows: { updated_at?: string | null; published_at?: string | null }[]) =>
    rows.map(row => row.updated_at || row.published_at).filter(Boolean).sort().pop() ?? null;

  return [
    entry('', newest(projects), 1),
    entry('/projects', newest(projects), 0.8),
    entry('/articles', newest(posts), 0.8),
    entry('/contact', null, 0.6),
    ...projects.map(project => entry(`/projects/${project.slug}`, project.updated_at || project.published_at, 0.7)),
    ...posts.map(post => entry(`/articles/${post.slug}`, post.updated_at || post.published_at, 0.7)),
  ];
}
