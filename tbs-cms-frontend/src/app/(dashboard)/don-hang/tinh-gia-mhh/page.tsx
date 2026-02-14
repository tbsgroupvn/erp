'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { MHHPriceCalculator } from '@/components/mhh/MHHPriceCalculator';

export default function TinhGiaMHHPage() {
  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Link
          href="/don-hang"
          className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md border hover:bg-accent touch-manipulation"
        >
          <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Link>
        <PageHeader
          title="T\u00EDnh gi\u00E1 MHH"
          description="C\u00F4ng c\u1EE5 t\u00EDnh gi\u00E1 nhanh d\u1ECBch v\u1EE5 Mua h\u00E0ng h\u1ED9 cho kh\u00E1ch h\u00E0ng"
          className="pb-0 text-lg sm:text-2xl"
        />
      </div>

      <MHHPriceCalculator />
    </div>
  );
}
