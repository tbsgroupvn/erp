'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface MenuItem {
  id: string;
  label: string;
  url: string;
  target: string;
  order: number;
  children?: MenuItem[];
}

interface Menu {
  id: string;
  name: string;
  location: string;
  items: MenuItem[];
}

async function getPublicMenu(location: string): Promise<Menu | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const res = await fetch(`${apiUrl}/public/cms/menus/${location}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch {
    return null;
  }
}

interface CMSMenuProps {
  location: 'HEADER' | 'FOOTER' | 'SIDEBAR';
  className?: string;
}

export function CMSMenu({ location, className = '' }: CMSMenuProps) {
  const { data: menu } = useQuery({
    queryKey: ['public-menu', location],
    queryFn: () => getPublicMenu(location),
  });

  if (!menu || !menu.items || menu.items.length === 0) {
    return null;
  }

  const renderMenuItem = (item: MenuItem) => {
    const isExternal = item.url.startsWith('http');

    return (
      <li key={item.id}>
        <Link
          href={item.url}
          target={item.target}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="hover:text-primary transition-colors"
        >
          {item.label}
        </Link>
        {item.children && item.children.length > 0 && (
          <ul className="ml-4 mt-2 space-y-2">
            {item.children.map((child) => renderMenuItem(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className={className}>
      <ul className="space-y-2">
        {menu.items.map((item) => renderMenuItem(item))}
      </ul>
    </nav>
  );
}

// Horizontal menu for header
export function CMSHeaderMenu({ className = '' }: { className?: string }) {
  const { data: menu } = useQuery({
    queryKey: ['public-menu', 'HEADER'],
    queryFn: () => getPublicMenu('HEADER'),
  });

  if (!menu || !menu.items || menu.items.length === 0) {
    return null;
  }

  return (
    <nav className={className}>
      <ul className="flex items-center gap-6">
        {menu.items.map((item) => {
          const isExternal = item.url.startsWith('http');
          return (
            <li key={item.id}>
              <Link
                href={item.url}
                target={item.target}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="hover:text-primary transition-colors font-medium"
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Footer menu with columns
export function CMSFooterMenu({ className = '' }: { className?: string }) {
  const { data: menu } = useQuery({
    queryKey: ['public-menu', 'FOOTER'],
    queryFn: () => getPublicMenu('FOOTER'),
  });

  if (!menu || !menu.items || menu.items.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="font-semibold mb-4">{menu.name}</h3>
      <ul className="space-y-2">
        {menu.items.map((item) => {
          const isExternal = item.url.startsWith('http');
          return (
            <li key={item.id}>
              <Link
                href={item.url}
                target={item.target}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
