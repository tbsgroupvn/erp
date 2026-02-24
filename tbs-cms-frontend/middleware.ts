import { NextRequest, NextResponse } from 'next/server';

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

  const cookieName = process.env.NEXT_PUBLIC_AUTH_COOKIE || 'erp-auth';
  const token = request.cookies.get(cookieName)?.value;

  if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
    const loginUrl = new URL('/login', request.url);
    // Sanitize callbackUrl to only allow relative paths
    if (pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('://')) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Validate JWT structure
  const parts = token.split('.');
  if (parts.length !== 3) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(cookieName);
    return response;
  }
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(cookieName);
      return response;
    }
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(cookieName);
    return response;
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
