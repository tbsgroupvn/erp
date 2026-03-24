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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exact match for root path, startsWith for other public paths
  if (pathname === '/' || publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check auth flag cookie (set by frontend JS on login)
  // This is a lightweight presence check — real JWT validation happens on API calls
  const authFlag = request.cookies.get(AUTH_COOKIE)?.value;

  if (!authFlag || authFlag.trim() === '' || authFlag === 'undefined' || authFlag === 'null') {
    const loginUrl = new URL('/login', request.url);
    // Sanitize callbackUrl to only allow relative paths
    if (pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('://')) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|logo.svg).*)'],
};
