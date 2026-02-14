'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Search, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Trang chủ', icon: Home },
  { href: '/dich-vu', label: 'Dịch vụ', icon: Package },
  { href: '/tra-cuu', label: 'Tra cứu', icon: Search },
  { href: '/lien-he', label: 'Liên hệ', icon: Phone },
  { href: '/tai-khoan', label: 'Tài khoản', icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-lg md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  isActive && 'scale-110'
                )}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
