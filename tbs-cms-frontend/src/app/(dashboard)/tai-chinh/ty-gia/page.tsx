'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useActiveRates,
  useExchangeRateHistory,
  useSetExchangeRate,
  useConvertCurrency,
  useSyncVietcombank,
} from '@/lib/hooks/use-exchange-rate';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Currency } from '@/lib/types/enums';

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.VND]: 'VND',
  [Currency.CNY]: 'CNY (Nh\u00e2n d\u00e2n t\u1ec7)',
  [Currency.USD]: 'USD (\u0110\u00f4 la M\u1ef9)',
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

  // ---- Update form state ----
  const [showForm, setShowForm] = useState(false);
  const [rateForm, setRateForm] = useState({
    from: '' as string,
    to: '' as string,
    rate: '',
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

  // ---- Handlers ----
  const handleSetRate = () => {
    if (!rateForm.from || !rateForm.to || !rateForm.rate) return;
    setRate.mutate(
      {
        from: rateForm.from as Currency,
        to: rateForm.to as Currency,
        rate: Number(rateForm.rate),
        source: rateForm.source || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setRateForm({ from: '', to: '', rate: '', source: '' });
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
      <PageHeader title="T\u1ef7 gi\u00e1" description="Qu\u1ea3n l\u00fd t\u1ef7 gi\u00e1 h\u1ed1i \u0111o\u00e1i">
        <Button
          variant="outline"
          disabled={syncVcb.isPending}
          onClick={() => syncVcb.mutate()}
        >
          {syncVcb.isPending ? '\u0110ang \u0111\u1ed3ng b\u1ed9...' : '\u0110\u1ed3ng b\u1ed9 Vietcombank'}
        </Button>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? '\u0110\u00f3ng' : 'C\u1eadp nh\u1eadt t\u1ef7 gi\u00e1'}
        </Button>
      </PageHeader>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">CNY &rarr; VND</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRates ? (
              <p className="text-sm text-muted-foreground">\u0110ang t\u1ea3i...</p>
            ) : cnyCurrent ? (
              <div>
                <p className="text-2xl font-bold">
                  {cnyCurrent.rate.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ngu\u1ed3n: {cnyCurrent.source || '---'} &middot; {formatDate(cnyCurrent.date, 'dd/MM/yyyy')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">USD &rarr; VND</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRates ? (
              <p className="text-sm text-muted-foreground">\u0110ang t\u1ea3i...</p>
            ) : usdCurrent ? (
              <div>
                <p className="text-2xl font-bold">
                  {usdCurrent.rate.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ngu\u1ed3n: {usdCurrent.source || '---'} &middot; {formatDate(usdCurrent.date, 'dd/MM/yyyy')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Update Rate Form ===== */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">C\u1eadp nh\u1eadt t\u1ef7 gi\u00e1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>T\u1eeb ti\u1ec1n t\u1ec7 *</Label>
                <Select
                  value={rateForm.from}
                  onValueChange={(v) => setRateForm((prev) => ({ ...prev, from: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ch\u1ecdn ti\u1ec1n t\u1ec7" />
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
                <Label>\u0110\u1ebfn ti\u1ec1n t\u1ec7 *</Label>
                <Select
                  value={rateForm.to}
                  onValueChange={(v) => setRateForm((prev) => ({ ...prev, to: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ch\u1ecdn ti\u1ec1n t\u1ec7" />
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
                <Label>T\u1ef7 gi\u00e1 *</Label>
                <Input
                  type="number"
                  placeholder="Nh\u1eadp t\u1ef7 gi\u00e1"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm((prev) => ({ ...prev, rate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Ngu\u1ed3n</Label>
                <Input
                  placeholder="VD: Vietcombank"
                  value={rateForm.source}
                  onChange={(e) => setRateForm((prev) => ({ ...prev, source: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button disabled={setRate.isPending} onClick={handleSetRate}>
                {setRate.isPending ? '\u0110ang l\u01b0u...' : 'L\u01b0u t\u1ef7 gi\u00e1'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setRateForm({ from: '', to: '', rate: '', source: '' });
                }}
              >
                H\u1ee7y
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Convert Card ===== */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Quy \u0111\u1ed5i</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>T\u1eeb ti\u1ec1n t\u1ec7</Label>
              <Select
                value={convertForm.from}
                onValueChange={(v) => setConvertForm((prev) => ({ ...prev, from: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ch\u1ecdn ti\u1ec1n t\u1ec7" />
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
              <Label>\u0110\u1ebfn ti\u1ec1n t\u1ec7</Label>
              <Select
                value={convertForm.to}
                onValueChange={(v) => setConvertForm((prev) => ({ ...prev, to: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ch\u1ecdn ti\u1ec1n t\u1ec7" />
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
              <Label>S\u1ed1 ti\u1ec1n</Label>
              <Input
                type="number"
                placeholder="Nh\u1eadp s\u1ed1 ti\u1ec1n"
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
                {convertCurrency.isPending ? '\u0110ang quy \u0111\u1ed5i...' : 'Quy \u0111\u1ed5i'}
              </Button>
            </div>
          </div>

          {convertResult && (
            <Card className="mt-4 bg-muted/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">S\u1ed1 ti\u1ec1n g\u1ed1c</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(convertResult.amount, convertResult.from)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">T\u1ef7 gi\u00e1 \u00e1p d\u1ee5ng</p>
                    <p className="text-lg font-semibold">
                      {convertResult.rate.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">K\u1ebft qu\u1ea3</p>
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

      {/* ===== History Table ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">L\u1ecbch s\u1eed t\u1ef7 gi\u00e1</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-sm text-muted-foreground">\u0110ang t\u1ea3i...</p>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u l\u1ecbch s\u1eed.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Ng\u00e0y</th>
                    <th className="pb-3 pr-4">T\u1eeb</th>
                    <th className="pb-3 pr-4">\u0110\u1ebfn</th>
                    <th className="pb-3 pr-4 text-right">T\u1ef7 gi\u00e1</th>
                    <th className="pb-3">Ngu\u1ed3n</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 text-sm">
                      <td className="py-3 pr-4">{formatDate(row.date, 'dd/MM/yyyy')}</td>
                      <td className="py-3 pr-4">{CURRENCY_LABELS[row.from]}</td>
                      <td className="py-3 pr-4">{CURRENCY_LABELS[row.to]}</td>
                      <td className="py-3 pr-4 text-right font-medium">
                        {row.rate.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3">{row.source || '---'}</td>
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
