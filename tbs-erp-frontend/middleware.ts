import { NextRequest, NextResponse } from 'next/server';
import { ROLE_MENU_ACCESS } from '@/lib/utils/permissions';

const AUTH_COOKIE = process.env.NEXT_PUBLIC_AUTH_COOKIE || 'erp-auth';
const ROLE_COOKIE = process.env.NEXT_PUBLIC_ROLE_COOKIE || 'erp-role';

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
  '/hoi-dap',
  '/so-sanh',
];

/** Routes accessible to ALL authenticated users regardless of role. */
const universalAuthPaths = [
  '/tong-quan',
  '/dashboard',
  '/403',
  '/ho-so',
  '/doi-mat-khau',
];

/** Admin/CMS paths -- only CEO, COO, CFO, DIRECTOR_OPERATIONS can access. */
const adminPaths = ['/admin', '/cms'];

/**
 * Valid UserRole values (matches the backend enum).
 * Used to validate the role cookie value on the Edge.
 */
const VALID_ROLES = new Set([
  'CEO', 'COO', 'CFO', 'DIRECTOR_OPERATIONS',
  'SALES_DIRECTOR', 'SALES_LEADER', 'SALE',
  'MARKETING_STAFF', 'CSKH',
  'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'ACCOUNTANT_AR', 'ACCOUNTANT_COST',
  'HR_MANAGER', 'LOGISTICS_MANAGER',
  'XNK_MANAGER', 'XNK_STAFF',
  'WAREHOUSE_MANAGER', 'WAREHOUSE_CN_AGENT', 'WAREHOUSE_VN_MANAGER', 'WAREHOUSE_VN_STAFF',
  'DRIVER',
]);

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Use btoa + String.fromCharCode -- both available in Edge Runtime (no Buffer needed)
  return btoa(String.fromCharCode(...array));
}

/**
 * Check whether the given role is allowed to access a route path.
 * Mirrors canAccessRoute() from permissions.ts but works with raw string role.
 */
function isRouteAllowed(role: string, pathname: string): boolean {
  const allowedPrefixes = ROLE_MENU_ACCESS[role as keyof typeof ROLE_MENU_ACCESS];
  if (!allowedPrefixes) return false;
  return allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate CSP nonce for this request
  const nonce = generateNonce();

  // --- 1. Public routes: no auth check needed ---
  if (pathname === '/' || publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    applySecurityHeaders(response, nonce);
    return response;
  }

  // --- 2. Auth check: require auth cookie ---
  const authFlag = request.cookies.get(AUTH_COOKIE)?.value;

  if (!authFlag || authFlag.trim() === '' || authFlag === 'undefined' || authFlag === 'null') {
    const loginUrl = new URL('/login', request.url);
    // Sanitize callbackUrl to only allow relative paths
    if (pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('://')) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // --- 3. RBAC check: enforce route-level permissions ---
  const roleCookieValue = request.cookies.get(ROLE_COOKIE)?.value;
  const role = roleCookieValue ? decodeURIComponent(roleCookieValue) : null;

  // Skip RBAC if role cookie is missing (backward compat for sessions before this change).
  // The user will still be authenticated; the role cookie will be set on next login or profile fetch.
  if (role && VALID_ROLES.has(role)) {
    // Universal paths are always allowed for any authenticated user
    const isUniversal = universalAuthPaths.some((p) => pathname.startsWith(p));

    if (!isUniversal) {
      // Admin/CMS paths: restricted to executive roles
      const isAdminPath = adminPaths.some((p) => pathname.startsWith(p));
      if (isAdminPath) {
        const executiveRoles = new Set(['CEO', 'COO', 'CFO', 'DIRECTOR_OPERATIONS']);
        if (!executiveRoles.has(role)) {
          const forbiddenUrl = new URL('/403', request.url);
          return NextResponse.redirect(forbiddenUrl);
        }
      } else {
        // Regular dashboard routes: check against ROLE_MENU_ACCESS
        if (!isRouteAllowed(role, pathname)) {
          const forbiddenUrl = new URL('/403', request.url);
          return NextResponse.redirect(forbiddenUrl);
        }
      }
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, nonce);
  return response;
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Nonce-based CSP -- eliminates need for unsafe-inline/unsafe-eval
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
