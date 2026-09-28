import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { isAdminEmail } from './lib/auth/allowlist';
import { holdingPage, lockDecision, unlockCookie, unlockParam } from './lib/site-lock';

const intlMiddleware = createMiddleware(routing);

function loginRedirect(request: NextRequest, cookiesFrom?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  url.searchParams.set('next', request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  cookiesFrom?.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
  return response;
}

async function adminMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/admin/login';
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  const isServerAction = request.headers.has('next-action');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing config: the login page explains it; everything else bounces there.
  if (!url || !key) return isLoginPage ? NextResponse.next() : loginRedirect(request);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });

  const { data } = await supabase.auth.getUser();
  const isAdmin = Boolean(data.user) && isAdminEmail(data.user?.email);

  if (isLoginPage) {
    if (isAdmin && isRead) return NextResponse.redirect(new URL('/admin', request.url));
    return response;
  }
  if (isAdmin) return response;
  // Server Actions verify the session themselves and return a friendly state; other writes get a plain 401.
  if (isServerAction) return response;
  if (!isRead) return NextResponse.json({ ok: false, message: '請先登入管理員帳號。' }, { status: 401 });
  return loginRedirect(request, response);
}

/**
 * The curtain over the public site while `SITE_LOCKED` is set; see lib/site-lock.ts for what stays
 * open behind it. 503 rather than 404 or 401: it is the status that means "not yet", so a crawler
 * comes back instead of recording that the page is missing. Never cached, or the curtain would
 * outlive the decision to draw it.
 */
function lockedResponse(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  const secret = process.env.SITE_UNLOCK;
  const decision = lockDecision({
    locked: process.env.SITE_LOCKED === 'true',
    pathname,
    presented: searchParams.get(unlockParam),
    cookie: request.cookies.get(unlockCookie)?.value,
    secret,
  });
  if (decision === 'open') return null;
  if (decision === 'unlock') {
    const url = request.nextUrl.clone();
    url.searchParams.delete(unlockParam);
    const response = NextResponse.redirect(url);
    response.cookies.set(unlockCookie, secret!, {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 90,
    });
    return response;
  }
  return new NextResponse(holdingPage(), {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'retry-after': '86400',
    },
  });
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const held = lockedResponse(request);
  if (held) return held;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return adminMiddleware(request);
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|admin|resume|_next|_vercel|.*\\..*).*)', '/admin/:path*'],
};
