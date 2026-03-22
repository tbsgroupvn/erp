'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { GlobalSearch } from './global-search';
import { CMSHeaderMenu } from '@/components/public/cms-menu';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <span className="text-xl font-bold">{(process.env.NEXT_PUBLIC_COMPANY_NAME || 'TBS').substring(0, 3)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">{process.env.NEXT_PUBLIC_APP_TITLE || 'TBS ERP'}</span>
              <span className="text-xs text-gray-500">{process.env.NEXT_PUBLIC_COMPANY_NAME || ''}</span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <CMSHeaderMenu className="hidden items-center gap-8 md:flex" />

          {/* Search & CTA */}
          <div className="hidden items-center gap-4 md:flex">
            <div className="w-64 lg:w-80">
              <GlobalSearch />
            </div>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md whitespace-nowrap"
            >
              Đăng nhập ERP
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="border-t border-gray-200 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              <CMSHeaderMenu className="flex flex-col gap-4" />

              <Link
                href="/login"
                onClick={closeMenu}
                className="mt-2 rounded-lg bg-blue-600 px-6 py-2 text-center text-sm font-semibold text-white transition-all hover:bg-blue-700"
              >
                Đăng nhập ERP
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
