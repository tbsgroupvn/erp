'use client';

import { Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { branding } from '@/lib/config/branding';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Currency } from '@/lib/types';

// ---------------------------------------------------------------------------
// Đọc số tiền bằng chữ (tiếng Việt)
// ---------------------------------------------------------------------------

const DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(n: number, readHundredZero: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  const parts: string[] = [];

  if (hundreds > 0 || readHundredZero) {
    parts.push(DIGIT_WORDS[hundreds], 'trăm');
  }
  if (tens > 1) {
    parts.push(DIGIT_WORDS[tens], 'mươi');
    if (units === 1) parts.push('mốt');
    else if (units === 4) parts.push('tư');
    else if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(DIGIT_WORDS[units]);
  } else if (tens === 1) {
    parts.push('mười');
    if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(DIGIT_WORDS[units]);
  } else if (units > 0) {
    if (hundreds > 0 || readHundredZero) parts.push('lẻ');
    parts.push(DIGIT_WORDS[units]);
  }
  return parts.join(' ');
}

/** Chuyển số nguyên không âm thành chữ tiếng Việt, VD: 1500000 -> "Một triệu năm trăm nghìn" */
export function numberToVietnameseWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  let n = Math.floor(value);
  if (n === 0) return 'Không';

  const unitNames = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const isLeadingGroup = i === groups.length - 1;
    parts.push(readThreeDigits(groups[i], !isLeadingGroup) + unitNames[i]);
  }
  const sentence = parts.join(' ').trim();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractPreviewCustomer {
  code?: string;
  fullName: string;
  companyName?: string | null;
  address?: string | null;
  taxCode?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ContractPreviewData {
  /** Mã hợp đồng — để trống khi chưa tạo */
  code?: string;
  title: string;
  /** Nhãn loại: "Hợp đồng chính" | "Phụ lục" */
  typeLabel: string;
  effectiveDate?: string;
  expiryDate?: string;
  signedDate?: string;
  totalValue?: number;
  depositRequired?: number;
  currency?: string;
  terms?: string;
  note?: string;
  /** Người phụ trách (sale) */
  saleName?: string;
}

interface ContractPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ContractPreviewData;
  customer: ContractPreviewCustomer | null;
  /** Nút hành động bổ sung ở footer (VD: nút "Tạo hợp đồng" khi xem trước lúc tạo) */
  footer?: React.ReactNode;
}

const DOTTED = '.......................................';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <p className="text-sm leading-6">
      <span className="font-medium">{label}:</span>{' '}
      {value && value.trim() !== '' ? value : DOTTED}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContractPreview({ open, onOpenChange, data, customer, footer }: ContractPreviewProps) {
  const effective = data.effectiveDate ? new Date(data.effectiveDate) : null;
  const currency = data.currency || Currency.VND;
  const isVnd = currency === Currency.VND;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible">
        {/* Khi in: chỉ hiển thị vùng nội dung hợp đồng */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #contract-print-area, #contract-print-area * { visibility: visible !important; }
            #contract-print-area {
              position: fixed;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 24px;
            }
          }
        `}</style>

        <DialogHeader className="print:hidden">
          <DialogTitle>Xem trước hợp đồng</DialogTitle>
        </DialogHeader>

        <div id="contract-print-area" className="bg-white text-black rounded-md border p-6 sm:p-8 space-y-5">
          {/* Quốc hiệu */}
          <div className="text-center space-y-0.5">
            <p className="text-sm font-semibold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
            <p className="text-sm font-medium">Độc lập - Tự do - Hạnh phúc</p>
            <p className="text-sm">---oOo---</p>
          </div>

          {/* Tiêu đề */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold uppercase">{data.typeLabel}</h2>
            <p className="text-sm font-medium">{data.title}</p>
            <p className="text-sm text-gray-600">
              Số: {data.code || '....../HĐ'}
            </p>
          </div>

          {effective && (
            <p className="text-sm italic">
              Hôm nay, ngày {formatDate(effective, 'dd')} tháng {formatDate(effective, 'MM')} năm{' '}
              {formatDate(effective, 'yyyy')}, chúng tôi gồm:
            </p>
          )}

          {/* Bên A - Khách hàng */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase">Bên A (Bên sử dụng dịch vụ)</h3>
            {customer ? (
              <>
                <Field
                  label={customer.companyName ? 'Công ty' : 'Ông/Bà'}
                  value={customer.companyName || customer.fullName}
                />
                {customer.companyName && <Field label="Người đại diện" value={customer.fullName} />}
                <Field label="Địa chỉ" value={customer.address} />
                <Field label="Mã số thuế" value={customer.taxCode} />
                <Field label="Điện thoại" value={customer.phone} />
                <Field label="Email" value={customer.email} />
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Chưa chọn khách hàng</p>
            )}
          </div>

          {/* Bên B - Công ty */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase">Bên B (Bên cung cấp dịch vụ)</h3>
            <Field label="Công ty" value={branding.companyFullName} />
            <Field label="Địa chỉ" value={branding.companyAddress} />
            <Field label="Mã số thuế" value={branding.companyTaxCode} />
            <Field label="Điện thoại" value={branding.supportPhone} />
            <Field label="Email" value={branding.supportEmail} />
            {data.saleName && <Field label="Người phụ trách" value={data.saleName} />}
          </div>

          {/* Điều 1: Giá trị */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold">ĐIỀU 1: GIÁ TRỊ HỢP ĐỒNG</h3>
            <p className="text-sm leading-6">
              Tổng giá trị hợp đồng:{' '}
              <span className="font-semibold">{formatCurrency(data.totalValue ?? 0, currency)}</span>
              {isVnd && (data.totalValue ?? 0) > 0 && (
                <span className="italic"> (Bằng chữ: {numberToVietnameseWords(data.totalValue ?? 0)} đồng)</span>
              )}
            </p>
            <p className="text-sm leading-6">
              Đặt cọc yêu cầu:{' '}
              <span className="font-semibold">{formatCurrency(data.depositRequired ?? 0, currency)}</span>
              {isVnd && (data.depositRequired ?? 0) > 0 && (
                <span className="italic"> (Bằng chữ: {numberToVietnameseWords(data.depositRequired ?? 0)} đồng)</span>
              )}
            </p>
          </div>

          {/* Điều 2: Thời hạn */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold">ĐIỀU 2: THỜI HẠN HỢP ĐỒNG</h3>
            <p className="text-sm leading-6">
              Hợp đồng có hiệu lực từ ngày{' '}
              <span className="font-medium">
                {data.effectiveDate ? formatDate(data.effectiveDate, 'dd/MM/yyyy') : DOTTED}
              </span>
              {data.expiryDate && (
                <>
                  {' '}đến hết ngày <span className="font-medium">{formatDate(data.expiryDate, 'dd/MM/yyyy')}</span>
                </>
              )}
              .
            </p>
            {data.signedDate && (
              <p className="text-sm leading-6">
                Ngày ký: <span className="font-medium">{formatDate(data.signedDate, 'dd/MM/yyyy')}</span>
              </p>
            )}
          </div>

          {/* Điều 3: Điều khoản */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold">ĐIỀU 3: ĐIỀU KHOẢN THỎA THUẬN</h3>
            {data.terms && data.terms.trim() !== '' ? (
              <div className="text-sm leading-6 whitespace-pre-wrap">{data.terms}</div>
            ) : (
              <p className="text-sm leading-6 text-gray-500 italic">
                Hai bên thống nhất thực hiện theo các điều khoản đính kèm và quy định pháp luật hiện hành.
              </p>
            )}
          </div>

          {data.note && data.note.trim() !== '' && (
            <div className="space-y-1">
              <h3 className="text-sm font-bold">GHI CHÚ</h3>
              <p className="text-sm leading-6 whitespace-pre-wrap">{data.note}</p>
            </div>
          )}

          {/* Chữ ký */}
          <div className="grid grid-cols-2 gap-4 pt-6 pb-10 text-center">
            <div>
              <p className="text-sm font-bold uppercase">Đại diện Bên A</p>
              <p className="text-xs italic text-gray-600">(Ký, ghi rõ họ tên)</p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase">Đại diện Bên B</p>
              <p className="text-xs italic text-gray-600">(Ký, ghi rõ họ tên)</p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Printer className="h-4 w-4" />
            In hợp đồng
          </button>
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
