'use client';

import { useState, useCallback, type ElementType } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon,
  Banknote,
  Search,
} from 'lucide-react';
import {
  useReconciliationSummary,
  useManualMatch,
  useOverdueReceivables,
} from '@/lib/hooks/use-finance';
import type { UnmatchedTransaction } from '@/lib/api/finance.api';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Stat card for summary
// ---------------------------------------------------------------------------

interface StatTileProps {
  label: string;
  value: number;
  icon: ElementType;
  colour: 'blue' | 'green' | 'amber' | 'red';
}

const COLOURS = {
  blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  icon: 'text-blue-500'  },
  green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
  red:   { bg: 'bg-red-50',   text: 'text-red-700',   icon: 'text-red-500'   },
};

function StatTile({ label, value, icon: Icon, colour }: StatTileProps) {
  const c = COLOURS[colour];
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-4', c.bg)}>
      <div className={cn('p-2 rounded-lg bg-white/70', c.icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={cn('text-2xl font-bold tabular-nums', c.text)}>{value.toLocaleString('vi-VN')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual match dialog
// ---------------------------------------------------------------------------

interface MatchDialogProps {
  transaction: UnmatchedTransaction;
  arOptions: { id: string; code: string; customerId: string; customerName: string; amount: number }[];
  onClose: () => void;
  onSubmit: (arId: string, customerId: string, note: string) => void;
  isPending: boolean;
}

function MatchDialog({ transaction, arOptions, onClose, onSubmit, isPending }: MatchDialogProps) {
  const [selectedArId, setSelectedArId] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  const filtered = arOptions.filter(
    (ar) =>
      ar.code.toLowerCase().includes(search.toLowerCase()) ||
      ar.customerName.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedAr = arOptions.find((a) => a.id === selectedArId);

  const handleSubmit = () => {
    if (!selectedAr) return;
    onSubmit(selectedAr.id, selectedAr.customerId, note);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-base">Khớp lệnh thủ công</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Transaction info */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ngân hàng ref:</span>
              <span className="font-mono font-medium">{transaction.bankRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số tiền:</span>
              <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nội dung:</span>
              <span className="text-right max-w-[240px] text-xs">{transaction.description}</span>
            </div>
          </div>

          {/* AR search */}
          <div className="space-y-2">
            <label htmlFor="ar-search" className="text-sm font-medium">Chọn công nợ phải thu (AR)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="ar-search"
                type="text"
                placeholder="Tìm theo mã AR, khách hàng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Không có kết quả</p>
              ) : (
                filtered.map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setSelectedArId(ar.id)}
                    className={cn(
                      'w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/50 transition-colors',
                      selectedArId === ar.id && 'bg-primary/10',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{ar.code}</p>
                      <p className="text-xs text-muted-foreground">{ar.customerName}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(ar.amount)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label htmlFor="match-note" className="text-sm font-medium">Ghi chú</label>
            <input
              id="match-note"
              type="text"
              placeholder="Lý do khớp thủ công..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedArId || isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận khớp'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReconciliationDashboard() {
  const { data, isLoading, refetch, isFetching } = useReconciliationSummary();
  const { data: arData } = useOverdueReceivables();
  const { mutate: doMatch, isPending: isMatching } = useManualMatch();

  const [selectedTx, setSelectedTx] = useState<UnmatchedTransaction | null>(null);
  const [search, setSearch] = useState('');

  const arOptions = (arData ?? []).map((ar) => ({
    id: ar.id,
    code: ar.code,
    customerId: ar.customerId,
    customerName: ar.customerId, // customerId used as display name until customer lookup is available
    amount: ar.amount - ar.paidAmount,
  }));

  const filteredTransactions = (data?.unmatchedTransactions ?? []).filter(
    (tx) =>
      tx.bankRef.toLowerCase().includes(search.toLowerCase()) ||
      tx.description.toLowerCase().includes(search.toLowerCase()),
  );

  const handleMatch = useCallback(
    (arId: string, customerId: string, note: string) => {
      if (!selectedTx) return;
      doMatch(
        { transactionId: selectedTx.id, arId, customerId, note },
        { onSuccess: () => setSelectedTx(null) },
      );
    },
    [selectedTx, doMatch],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Tổng giao dịch"
          value={summary?.totalTransactions ?? 0}
          icon={Banknote}
          colour="blue"
        />
        <StatTile
          label="Đã khớp"
          value={summary?.matched ?? 0}
          icon={CheckCircle2}
          colour="green"
        />
        <StatTile
          label="Chưa khớp"
          value={summary?.unmatched ?? 0}
          icon={AlertCircle}
          colour="amber"
        />
        <StatTile
          label="Lỗi"
          value={summary?.errors ?? 0}
          icon={XCircle}
          colour="red"
        />
      </div>

      {/* Unmatched transactions */}
      <div className="rounded-xl border bg-background overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-sm">Giao dịch chưa khớp</h3>
            {summary?.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Đồng bộ lần cuối: {new Date(summary.lastSyncAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Làm mới
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo ref, nội dung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
            <p>Tất cả giao dịch đã được khớp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Ngày</th>
                  <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nội dung</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ngân hàng</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ref</th>
                  <th className="px-4 py-2.5 text-center font-medium w-32">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 max-w-[240px] truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{tx.bankAccount}</td>
                    <td className="px-4 py-3 font-mono text-xs">{tx.bankRef}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Khớp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual match dialog */}
      {selectedTx && (
        <MatchDialog
          transaction={selectedTx}
          arOptions={arOptions}
          onClose={() => setSelectedTx(null)}
          onSubmit={handleMatch}
          isPending={isMatching}
        />
      )}
    </div>
  );
}
