'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  label: string;
  href: string;
  children?: MenuItem[];
}

interface MobileMenuProps {
  items: MenuItem[];
}

export function MobileMenu({ items }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Menu toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Đóng menu' : 'Mở menu'}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Menu header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Menu items */}
        <nav className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 73px)' }}>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-4 py-3 text-base font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.label}
                  {item.children && (
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  )}
                </Link>

                {/* Submenu */}
                {item.children && (
                  <ul className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 pl-4">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={cn(
                            'block rounded-lg px-4 py-2 text-sm transition-colors',
                            pathname === child.href
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-600 hover:bg-gray-50'
                          )}
                          aria-current={pathname === child.href ? 'page' : undefined}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
