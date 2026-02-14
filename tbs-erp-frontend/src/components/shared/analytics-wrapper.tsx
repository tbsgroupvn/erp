'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/utils/analytics';

/**
 * Analytics wrapper component
 * Automatically tracks page views on route changes
 */
export function AnalyticsWrapper() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    trackPageView(url);
  }, [pathname, searchParams]);

  return null;
}
