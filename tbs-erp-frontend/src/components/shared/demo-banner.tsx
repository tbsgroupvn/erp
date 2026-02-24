'use client';

import { useState } from 'react';
import { X, Info } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin', password: 'demo123' },
  { role: 'Giám đốc', email: 'giamdoc', password: 'demo123' },
  { role: 'Kế toán', email: 'ketoan', password: 'demo123' },
  { role: 'Kho', email: 'kho', password: 'demo123' },
  { role: 'Kinh doanh', email: 'kinhdoanh', password: 'demo123' },
  { role: 'Viewer', email: 'viewer', password: 'demo123' },
];

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;
  if (dismissed) return null;

  return (
    <div className="relative bg-amber-500 text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            Demo Mode — Dữ liệu sẽ được reset mỗi 24 giờ.
          </span>
          <button
            onClick={() => setShowAccounts(!showAccounts)}
            className="underline hover:no-underline font-medium"
          >
            {showAccounts ? 'Ẩn tài khoản' : 'Xem tài khoản demo'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 hover:bg-amber-600/20"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {showAccounts && (
        <div className="border-t border-amber-600/30 bg-amber-400/50">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {DEMO_ACCOUNTS.map((account) => (
                <div key={account.email} className="rounded bg-white/50 px-3 py-2 text-xs">
                  <div className="font-bold">{account.role}</div>
                  <div>{account.email}@...</div>
                  <div className="text-amber-800">Pass: {account.password}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
