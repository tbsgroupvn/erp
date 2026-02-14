'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FileText,
  Image,
  Menu,
  Settings,
  LayoutDashboard,
  LogOut,
  User,
  BookOpen,
  Mail,
  HelpCircle,
  Link as LinkIcon,
  Bell,
  Search
} from 'lucide-react';

export default function CMSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navigation = [
    {
      name: 'Tổng quan',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      name: 'Trang',
      href: '/admin/pages',
      icon: FileText,
    },
    {
      name: 'Blog',
      href: '/admin/blog',
      icon: BookOpen,
    },
    {
      name: 'Media',
      href: '/admin/media',
      icon: Image,
    },
    {
      name: 'Menu',
      href: '/admin/menus',
      icon: Menu,
    },
    {
      name: 'Liên hệ',
      href: '/admin/contacts',
      icon: Mail,
    },
    {
      name: 'FAQ',
      href: '/admin/faq',
      icon: HelpCircle,
    },
    {
      name: 'Cài đặt',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Bỏ qua đến nội dung chính
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/admin" className="flex items-center gap-3 cursor-pointer group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md transition-transform duration-200 group-hover:scale-105">
                <span className="text-xl font-bold">TBS</span>
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-lg font-bold text-slate-900">CMS Manager</span>
                <span className="text-xs text-slate-500">Content Management System</span>
              </div>
            </Link>

            {/* Main Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer',
                      isActive
                        ? 'bg-purple-50 text-purple-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 cursor-pointer"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <button
              className="hidden md:flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 cursor-pointer relative"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white"></span>
            </button>

            <div className="hidden md:block h-8 w-px bg-slate-200" />

            <Link
              href="/dashboard"
              className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 cursor-pointer"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard ERP</span>
            </Link>

            <Link
              href="/"
              className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkIcon className="h-4 w-4" />
              <span>Website</span>
            </Link>

            <div className="hidden md:block h-8 w-px bg-slate-200" />

            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="lg:hidden border-t border-slate-200 px-4 py-3 bg-white">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
            <p>&copy; 2026 TBS Logistics. All rights reserved.</p>
            <div className="flex gap-6">
              <Link
                href="/admin/help"
                className="hover:text-purple-600 transition-colors duration-200 cursor-pointer"
              >
                Trợ giúp
              </Link>
              <Link
                href="/admin/docs"
                className="hover:text-purple-600 transition-colors duration-200 cursor-pointer"
              >
                Tài liệu
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
