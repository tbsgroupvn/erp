import { NextRequest, NextResponse } from 'next/server';

const publicPaths = [
  '/',
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

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('tbs-auth')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|logo.svg).*)'],
};
