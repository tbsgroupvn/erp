'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { RoleGuard } from '@/components/shared/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useActiveRates,
  useExchangeRateHistory,
  useSetExchangeRate,
  useConvertCurrency,
  useSyncVietcombank,
} from '@/lib/hooks/use-exchange-rate';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Currency, UserRole } from '@/lib/types/enums';

// ---------------------------------------------------------------------------
// Types for extended exchange rate data
// ---------------------------------------------------------------------------
interface ExtendedExchangeRate {
  id: string;
  from: Currency;
  to: Currency;
  rate: number;
  source: string;
  date: string;
  createdAt: string;
  setBy?: string;
  isManual?: boolean;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.VND]: 'VND',
  [Currency.CNY]: 'CNY (Nhan dan te)',
  [Currency.USD]: 'USD (Do la My)',
};

export default function TyGiaPage() {
  // ---- Active rates for summary cards ----
  const { data: activeRates, isLoading: loadingRates } = useActiveRates();

  // ---- History ----
  const { data: history, isLoading: loadingHistory } = useExchangeRateHistory();

  // ---- Mutations ----
  const setRate = useSetExchangeRate();
  const convertCurrency = useConvertCurrency();
  const syncVcb = useSyncVietcombank();

  // ---- Update form state (CNY manual set) ----
  const [showForm, setShowForm] = useState(false);
  const [rateForm, setRateForm] = useState({
    from: 'CNY' as string,
    to: 'VND' as string,
    rate: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    source: '',
  });

  // ---- Convert form state ----
  const [convertForm, setConvertForm] = useState({
    from: '' as string,
    to: '' as string,
    amount: '',
  });
  const [convertResult, setConvertResult] = useState<{
    from: Currency;
    to: Currency;
    rate: number;
    amount: number;
    result: number;
  } | null>(null);

  // ---- Helpers ----
  const findRate = (from: Currency, to: Currency) => {
    if (!activeRates) return null;
    return activeRates.find((r) => r.from === from && r.to === to) ?? null;
  };

  const cnyCurrent = findRate(Currency.CNY, Currency.VND);
  const usdCurrent = findRate(Currency.USD, Currency.VND);

  // Cast history to extended type for display
  const extendedHistory = (history ?? []) as ExtendedExchangeRate[];

  // ---- Handlers ----
  const handleSetRate = () => {
    if (!rateForm.from || !rateForm.to || !rateForm.rate) return;
    setRate.mutate(
      {
        from: rateForm.from as Currency,
        to: rateForm.to as Currency,
        rate: Number(rateForm.rate),
        source: rateForm.source || 'Manual',
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setRateForm({
            from: 'CNY',
            to: 'VND',
            rate: '',
            effectiveDate: new Date().toISOString().split('T')[0],
            source: '',
          });
        },
      },
    );
  };

  const handleConvert = () => {
    if (!convertForm.from || !convertForm.to || !convertForm.amount) return;
    convertCurrency.mutate(
      {
        from: convertForm.from as Currency,
        to: convertForm.to as Currency,
        amount: Number(convertForm.amount),
      },
      {
        onSuccess: (data) => {
          setConvertResult(data);
        },
      },
    );
  };

  return (
    <div>
      <PageHeader title="Ty gia" description="Quan ly ty gia hoi doai">
        <Button
          variant="outline"
          disabled={syncVcb.isPending}
          onClick={() => syncVcb.mutate()}
        >
          {syncVcb.isPending ? 'Dang dong bo...' : 'Dong bo Vietcombank'}
        </Button>
        <RoleGuard allowedRoles={[UserRole.CHIEF_ACCOUNTANT, UserRole.CEO, UserRole.COO]}>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Dong' : 'Cap nhat ty gia thu cong'}
          </Button>
        </RoleGuard>
      </PageHeader>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">CNY &rarr; VND</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRates ? (
              <p className="text-sm text-muted-foreground">Dang tai...</p>
            ) : cnyCurrent ? (
              <div>
                <p className="text-2xl font-bold">
                  {cnyCurrent.rate.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Nguon: {cnyCurrent.source || '---'} &middot; {formatDate(cnyCurrent.date, 'dd/MM/yyyy')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chua co du lieu</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">USD &rarr; VND</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRates ? (
              <p className="text-sm text-muted-foreground">Dang tai...</p>
            ) : usdCurrent ? (
              <div>
                <p className="text-2xl font-bold">
                  {usdCurrent.rate.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Nguon: {usdCurrent.source || '---'} &middot; {formatDate(usdCurrent.date, 'dd/MM/yyyy')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chua co du lieu</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Current Exchange Rates Table ===== */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ty gia hien tai</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRates ? (
            <p className="text-sm text-muted-foreground">Dang tai...</p>
          ) : !activeRates || activeRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chua co du lieu ty gia.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Tu</th>
                    <th className="pb-3 pr-4">Den</th>
                    <th className="pb-3 pr-4 text-right">Ty gia</th>
                    <th className="pb-3 pr-4">Ngay</th>
                    <th className="pb-3 pr-4">Nguon</th>
                    <th className="pb-3 pr-4">Nguoi cap nhat</th>
                    <th className="pb-3">Loai</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeRates as ExtendedExchangeRate[]).map((row) => (
                    <tr key={row.id} className="border-b last:border-0 text-sm">
                      <td className="py-3 pr-4 font-medium">{row.from}</td>
                      <td className="py-3 pr-4 font-medium">{row.to}</td>
                      <td className="py-3 pr-4 text-right font-bold tabular-nums">
                        {row.rate.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 pr-4">{formatDate(row.date, 'dd/MM/yyyy')}</td>
                      <td className="py-3 pr-4">{row.source || '---'}</td>
                      <td className="py-3 pr-4">{row.setBy || '---'}</td>
                      <td className="py-3">
                        {row.isManual ? (
                          <Badge className="bg-amber-100 text-amber-700 border-0">Thu cong</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-0">Tu dong</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Manual CNY Rate Form (CHIEF_ACCOUNTANT only) ===== */}
      <RoleGuard allowedRoles={[UserRole.CHIEF_ACCOUNTANT, UserRole.CEO, UserRole.COO]}>
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Cap nhat ty gia CNY thu cong</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Tu tien te</Label>
                  <Select
                    value={rateForm.from}
                    onValueChange={(v) => setRateForm((prev) => ({ ...prev, from: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chon tien te" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNY">CNY</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Den tien te</Label>
                  <Select
                    value={rateForm.to}
                    onValueChange={(v) => setRateForm((prev) => ({ ...prev, to: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chon tien te" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VND">VND</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ty gia *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Nhap ty gia"
                    value={rateForm.rate}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, rate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ngay hieu luc *</Label>
                  <Input
                    type="date"
                    value={rateForm.effectiveDate}
                    onChange={(e) =>
                      setRateForm((prev) => ({ ...prev, effectiveDate: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nguon (tuy chon)</Label>
                  <Input
                    placeholder="VD: Vietcombank"
                    value={rateForm.source}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, source: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button disabled={setRate.isPending} onClick={handleSetRate}>
                  {setRate.isPending ? 'Dang luu...' : 'Luu ty gia'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setRateForm({
                      from: 'CNY',
                      to: 'VND',
                      rate: '',
                      effectiveDate: new Date().toISOString().split('T')[0],
                      source: '',
                    });
                  }}
                >
                  Huy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </RoleGuard>

      {/* ===== Convert Card ===== */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Quy doi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Tu tien te</Label>
              <Select
                value={convertForm.from}
                onValueChange={(v) => setConvertForm((prev) => ({ ...prev, from: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chon tien te" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Currency).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Den tien te</Label>
              <Select
                value={convertForm.to}
                onValueChange={(v) => setConvertForm((prev) => ({ ...prev, to: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chon tien te" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Currency).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>So tien</Label>
              <Input
                type="number"
                placeholder="Nhap so tien"
                value={convertForm.amount}
                onChange={(e) => setConvertForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={convertCurrency.isPending}
                onClick={handleConvert}
              >
                {convertCurrency.isPending ? 'Dang quy doi...' : 'Quy doi'}
              </Button>
            </div>
          </div>

          {convertResult && (
            <Card className="mt-4 bg-muted/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">So tien goc</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(convertResult.amount, convertResult.from)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ty gia ap dung</p>
                    <p className="text-lg font-semibold">
                      {convertResult.rate.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ket qua</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(convertResult.result, convertResult.to)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* ===== Audit Trail / History Table ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lich su thay doi (Audit Trail)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-sm text-muted-foreground">Dang tai...</p>
          ) : !extendedHistory || extendedHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chua co du lieu lich su.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Thoi gian</th>
                    <th className="pb-3 pr-4">Tu</th>
                    <th className="pb-3 pr-4">Den</th>
                    <th className="pb-3 pr-4 text-right">Ty gia</th>
                    <th className="pb-3 pr-4">Nguon</th>
                    <th className="pb-3 pr-4">Nguoi cap nhat</th>
                    <th className="pb-3">Loai</th>
                  </tr>
                </thead>
                <tbody>
                  {extendedHistory.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 text-sm">
                      <td className="py-3 pr-4">
                        {formatDate(row.createdAt, 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3 pr-4">{CURRENCY_LABELS[row.from]}</td>
                      <td className="py-3 pr-4">{CURRENCY_LABELS[row.to]}</td>
                      <td className="py-3 pr-4 text-right font-medium tabular-nums">
                        {row.rate.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 pr-4">{row.source || '---'}</td>
                      <td className="py-3 pr-4">{row.setBy || '---'}</td>
                      <td className="py-3">
                        {row.isManual ? (
                          <Badge className="bg-amber-100 text-amber-700 border-0">Thu cong</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-0">Tu dong</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
