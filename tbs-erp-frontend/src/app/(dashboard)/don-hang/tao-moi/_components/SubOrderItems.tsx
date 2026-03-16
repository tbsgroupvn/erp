'use client';

import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2, X, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { InfoTooltip } from '@/components/shared/info-tooltip';

export interface SubOrderItemsProps {
  control: any;
  register: any;
  errors: any;
  subOrderIndex: number;
  quickMode?: boolean;
}

export function SubOrderItems({
  control,
  register,
  errors,
  subOrderIndex,
  quickMode = false,
}: SubOrderItemsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `subOrders.${subOrderIndex}.items`,
  });

  const [showBatchPaste, setShowBatchPaste] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchPreview, setBatchPreview] = useState<
    { productName: string; quantity: number; unitPrice: number; productUrl?: string }[]
  >([]);

  const handleParseBatch = () => {
    const lines = batchText.trim().split('\n').filter((l) => l.trim());
    const parsed = lines
      .map((line) => {
        const cols = line.split('\t');
        return {
          productName: (cols[0] || '').trim(),
          quantity: parseInt(cols[1], 10) || 1,
          unitPrice: parseFloat(cols[2]) || 0,
          productUrl: (cols[3] || '').trim() || undefined,
        };
      })
      .filter((item) => item.productName.length >= 1);

    setBatchPreview(parsed);
  };

  const handleConfirmBatch = () => {
    if (batchPreview.length === 0) return;
    for (const item of batchPreview) {
      append({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        note: '',
      });
    }
    setShowBatchPaste(false);
    setBatchText('');
    setBatchPreview([]);
    toast.success(`Đã thêm ${batchPreview.length} sản phẩm`);
  };

  const handleCloseBatchPaste = () => {
    setShowBatchPaste(false);
    setBatchText('');
    setBatchPreview([]);
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        Hàng hóa
        <InfoTooltip tip={{ definition: 'Danh sách sản phẩm trong đơn con. Mỗi sản phẩm cần có tên, số lượng và đơn giá.' }} />
      </p>
      {fields.map((field, itemIdx) => (
        <div
          key={field.id}
          className="grid grid-cols-1 gap-3 sm:grid-cols-5 items-end border-b pb-3"
        >
          <div className="sm:col-span-2 space-y-1">
            <p className="text-xs font-medium">Sản phẩm *</p>
            <input
              {...register(`subOrders.${subOrderIndex}.items.${itemIdx}.productName`)}
              placeholder="Tên sản phẩm"
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.subOrders?.[subOrderIndex]?.items?.[itemIdx]?.productName && (
              <p className="text-xs text-destructive">
                {errors.subOrders[subOrderIndex].items[itemIdx].productName.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Số lượng</p>
            <input
              type="number"
              {...register(`subOrders.${subOrderIndex}.items.${itemIdx}.quantity`)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Đơn giá</p>
            <input
              type="number"
              {...register(`subOrders.${subOrderIndex}.items.${itemIdx}.unitPrice`)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => fields.length > 1 && remove(itemIdx)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      {errors.subOrders?.[subOrderIndex]?.items?.message && (
        <p className="text-xs text-destructive">
          {errors.subOrders[subOrderIndex].items.message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => append({ productName: '', quantity: 1, unitPrice: 0 })}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> Thêm sản phẩm
        </button>
        <button
          type="button"
          onClick={() => setShowBatchPaste(true)}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <ClipboardPaste className="h-4 w-4" /> Dán từ Excel
        </button>
      </div>

      {/* Batch Paste Modal */}
      {showBatchPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Dán hàng loạt từ Excel</h3>
              <button
                type="button"
                onClick={handleCloseBatchPaste}
                className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Copy các dòng từ Excel rồi dán vào ô bên dưới. Mỗi dòng một sản phẩm, các cột cách
              nhau bằng Tab.
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Thứ tự cột:{' '}
              <span className="font-medium">Tên SP</span> |{' '}
              <span className="font-medium">Số lượng</span> |{' '}
              <span className="font-medium">Đơn giá</span> |{' '}
              <span className="font-medium">Link SP (tùy chọn)</span>
            </p>
            <textarea
              value={batchText}
              onChange={(e) => {
                setBatchText(e.target.value);
                setBatchPreview([]);
              }}
              rows={6}
              placeholder={
                'Tên SP\tSố lượng\tĐơn giá\tLink SP\nTai nghe Bluetooth\t10\t150000\thttps://...\nÁo thun nam\t50\t200000'
              }
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleParseBatch}
                disabled={!batchText.trim()}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                Xem trước
              </button>
            </div>

            {batchPreview.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">
                  Xem trước ({batchPreview.length} sản phẩm):
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 py-1.5 text-left font-medium">Tên SP</th>
                        <th className="px-2 py-1.5 text-center font-medium">SL</th>
                        <th className="px-2 py-1.5 text-right font-medium">Đơn giá</th>
                        <th className="px-2 py-1.5 text-left font-medium">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchPreview.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-2 py-1.5">{item.productName}</td>
                          <td className="px-2 py-1.5 text-center">{item.quantity}</td>
                          <td className="px-2 py-1.5 text-right">
                            {item.unitPrice.toLocaleString('vi-VN')}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">
                            {item.productUrl || '\u2014'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmBatch}
                  className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Xác nhận thêm {batchPreview.length} sản phẩm
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
