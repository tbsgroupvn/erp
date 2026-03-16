import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = process.env.NEXT_PUBLIC_AUTH_COOKIE || 'erp-auth';

const publicPaths = [
  '/login',
  '/doi-mat-khau',
  '/dang-ky',
  '/dich-vu',
  '/tin-tuc',
  '/lien-he',
  '/gioi-thieu',
  '/tinh-phi',
  '/tra-cuu',
];

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Use btoa + String.fromCharCode — both available in Edge Runtime (no Buffer needed)
  return btoa(String.fromCharCode(...array));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate CSP nonce for this request
  const nonce = generateNonce();

  // Exact match for root path, startsWith for other public paths
  if (pathname === '/' || publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    applySecurityHeaders(response, nonce);
    return response;
  }

  // Auth cookie is a flag ("1") set by the client auth store.
  // Actual JWT validation happens server-side on each API call.
  const authFlag = request.cookies.get(AUTH_COOKIE)?.value;

  if (!authFlag || authFlag.trim() === '' || authFlag === 'undefined' || authFlag === 'null') {
    const loginUrl = new URL('/login', request.url);
    // Sanitize callbackUrl to only allow relative paths
    if (pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('://')) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, nonce);
  return response;
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Nonce-based CSP — eliminates need for unsafe-inline/unsafe-eval
  // Note: Next.js inline scripts need 'unsafe-inline' as fallback for browsers
  // that don't support nonce. Production should use strict-dynamic.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  let apiOrigin = '';
  try { apiOrigin = apiUrl ? new URL(apiUrl).origin : ''; } catch { /* ignore */ }
  const connectSources = ["'self'", apiOrigin, 'https:', 'wss:', 'ws:'].filter(Boolean).join(' ');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://maps.googleapis.com https://sp.zalo.me`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources}`,
    "frame-src 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|logo.svg).*)'],
};
