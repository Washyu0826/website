/**
 * A curtain across the public site, for the window between "deployed" and "ready to be read".
 *
 * The site went live on its own domain before the content was finished, and a half-written page that
 * gets crawled is expensive to take back: search engines cache it, and the first impression it makes
 * on a reader who arrives early is the only one they get. So while `SITE_LOCKED` is set, every public
 * page answers 503 with a holding note instead - the status that says "come back later" rather than
 * "this is gone", which is what keeps it out of an index without leaving a scar there afterwards.
 *
 * Three things stay open behind the curtain. `/admin` and its API, because the point of the curtain
 * is to keep writing; share links, because each one was handed to a particular person for a
 * particular file and breaking them would be worse than the curtain; and anyone who has been given
 * `SITE_UNLOCK`, who trades it once for a cookie and then browses normally.
 *
 * This is a curtain, not a lock. The secret travels in a query string and sits in a cookie in plain
 * text; it keeps the site out of search results and away from a casual visitor, and it is not the
 * thing standing between a stranger and the admin - Supabase Auth is.
 */
export const unlockCookie = 'site-unlock';
export const unlockParam = 'unlock';

/** Paths the curtain never covers, whatever else is true. */
export function alwaysOpen(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/') ||
    // /zh/share/<token> and /en/share/<token>: a link already sent to somebody.
    /^\/[a-z]{2}\/share\//.test(pathname)
  );
}

export type LockDecision = 'open' | 'hold' | 'unlock';

/**
 * `unlock` means the secret was just presented and the caller should set the cookie before letting
 * the request through; `open` means let it through as it is; `hold` means draw the curtain.
 */
export function lockDecision(input: {
  locked: boolean;
  pathname: string;
  presented: string | null;
  cookie: string | undefined;
  secret: string | undefined;
}): LockDecision {
  if (!input.locked) return 'open';
  if (alwaysOpen(input.pathname)) return 'open';
  const secret = input.secret?.trim();
  if (!secret) return 'hold';
  if (input.presented === secret) return 'unlock';
  if (input.cookie === secret) return 'open';
  return 'hold';
}

/**
 * The holding note. Inline everything: middleware runs before the app does, so there is no stylesheet
 * and no font to reach for, and one small document is the whole cost of being early.
 */
export function holdingPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Kuan-Yu Hsien</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px;
    background: #15171a; color: #f2efe8;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans TC", sans-serif;
  }
  main { max-width: 34rem; }
  p.mark { margin: 0 0 28px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
           font-size: 0.75rem; letter-spacing: 0.18em; color: #cb9743; }
  h1 { margin: 0 0 20px; font-size: clamp(2rem, 7vw, 3rem); line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; }
  p.line { margin: 0 0 10px; font-size: 1rem; line-height: 1.65; color: #a8a49b; }
  hr { margin: 32px 0 0; border: 0; height: 1px; background: linear-gradient(90deg, #cb9743, transparent); }
</style>
</head>
<body>
<main>
  <p class="mark">KUAN-YU HSIEN</p>
  <h1>Almost ready.</h1>
  <p class="line">The site is being written. It will open shortly.</p>
  <p class="line" lang="zh-Hant">網站正在整理內容，很快就會開放。</p>
  <hr>
</main>
</body>
</html>`;
}
