'use client';

import { useState } from 'react';
import { Search, X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchHSCodes } from '@/lib/hooks/use-customs-declaration';
import type { HSCodeResult } from '@/lib/types/customs.types';

interface HSCodeSearchPopoverProps {
  onSelect: (hs: HSCodeResult) => void;
  onClose: () => void;
}

export function HSCodeSearchPopover({ onSelect, onClose }: HSCodeSearchPopoverProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useSearchHSCodes(query);

  return (
    <div className="absolute z-50 mt-1 w-[500px] rounded-lg border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nhập mã HS hoặc mô tả..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 border-0 focus-visible:ring-0"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- search popup requires autofocus for keyboard UX
          autoFocus
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-center text-sm text-muted-foreground">Đang tìm...</div>
        )}
        {!isLoading && results && results.length === 0 && query.length > 1 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Không tìm thấy kết quả
          </div>
        )}
        {results?.map((hs) => {
          const CompIcon = hs.isProhibited
            ? XCircle
            : hs.isRestricted
              ? AlertTriangle
              : CheckCircle;
          const compClass = hs.isProhibited
            ? 'text-red-600'
            : hs.isRestricted
              ? 'text-yellow-600'
              : 'text-green-600';

          return (
            <button
              key={hs.id}
              onClick={() => onSelect(hs)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
            >
              <CompIcon className={`h-4 w-4 shrink-0 ${compClass}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{hs.code}</div>
                <div className="truncate text-muted-foreground text-xs">{hs.descriptionVi}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <div>Thuế NK: {hs.importDutyRate}%</div>
                <div>VAT: {hs.vatRate}%</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
