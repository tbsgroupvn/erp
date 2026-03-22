'use client';

import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { employeesApi } from '@/lib/api/employees.api';
import { employeeKeys } from '@/lib/hooks/use-employees';
import { Branch } from '@/lib/types/enums';
import type { CreateEmployeeDto } from '@/lib/types';

// ============================================
// TYPES
// ============================================

type Step = 'upload' | 'preview' | 'submit';

interface RawEmployeeRow {
  hoTen?: string;
  email?: string;
  soDienThoai?: string;
  phongBan?: string;
  chucVu?: string;
  chiNhanh?: string;
  ngayVaoLam?: string;
  luong?: string | number;
  nganHang?: string;
  soTaiKhoan?: string;
  maSoThue?: string;
  maBaoHiem?: string;
}

interface FieldError {
  field: string;
  message: string;
}

interface ValidatedRow {
  rowIndex: number;
  raw: RawEmployeeRow;
  isValid: boolean;
  errors: FieldError[];
}

interface SubmitResult {
  index: number;
  row: ValidatedRow;
  success: boolean;
  error?: string;
}

// ============================================
// EXCEL PARSING
// ============================================

async function parseExcelFile(buffer: ArrayBuffer): Promise<RawEmployeeRow[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  return rows.map((row) => ({
    hoTen: String(row['hoTen'] ?? row['Họ tên'] ?? '').trim(),
    email: String(row['email'] ?? row['Email'] ?? '').trim(),
    soDienThoai: String(row['soDienThoai'] ?? row['Số điện thoại'] ?? '').trim(),
    phongBan: String(row['phongBan'] ?? row['Phòng ban'] ?? '').trim(),
    chucVu: String(row['chucVu'] ?? row['Chức vụ'] ?? '').trim(),
    chiNhanh: String(row['chiNhanh'] ?? row['Chi nhánh'] ?? '').trim(),
    ngayVaoLam: String(row['ngayVaoLam'] ?? row['Ngày vào làm'] ?? '').trim(),
    luong: String(row['luong'] ?? row['Lương'] ?? '').trim(),
    nganHang: String(row['nganHang'] ?? row['Ngân hàng'] ?? '').trim(),
    soTaiKhoan: String(row['soTaiKhoan'] ?? row['Số tài khoản'] ?? '').trim(),
    maSoThue: String(row['maSoThue'] ?? row['Mã số thuế'] ?? '').trim(),
    maBaoHiem: String(row['maBaoHiem'] ?? row['Mã bảo hiểm'] ?? '').trim(),
  }));
}

// ============================================
// VALIDATION
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_BRANCHES: string[] = [Branch.HN, Branch.HCM];

function validateRows(rows: RawEmployeeRow[]): ValidatedRow[] {
  return rows.map((row, idx) => {
    const errors: FieldError[] = [];
    const rowIndex = idx + 2; // Excel row number (1-indexed header + 1 offset)

    // hoTen: required, max 200 chars
    if (!row.hoTen) {
      errors.push({ field: 'hoTen', message: 'Họ tên là bắt buộc' });
    } else if (row.hoTen.length > 200) {
      errors.push({ field: 'hoTen', message: 'Họ tên tối đa 200 ký tự' });
    }

    // email: optional, valid format
    if (row.email && !EMAIL_REGEX.test(row.email)) {
      errors.push({ field: 'email', message: 'Email không đúng định dạng' });
    }

    // phongBan: required
    if (!row.phongBan) {
      errors.push({ field: 'phongBan', message: 'Phòng ban là bắt buộc' });
    }

    // chucVu: required
    if (!row.chucVu) {
      errors.push({ field: 'chucVu', message: 'Chức vụ là bắt buộc' });
    }

    // chiNhanh: required, must be HN or HCM
    if (!row.chiNhanh) {
      errors.push({ field: 'chiNhanh', message: 'Chi nhánh là bắt buộc' });
    } else if (!VALID_BRANCHES.includes(row.chiNhanh.toUpperCase())) {
      errors.push({
        field: 'chiNhanh',
        message: `Chi nhánh phải là "HN" hoặc "HCM", nhận được "${row.chiNhanh}"`,
      });
    }

    // ngayVaoLam: required, valid YYYY-MM-DD
    if (!row.ngayVaoLam) {
      errors.push({ field: 'ngayVaoLam', message: 'Ngày vào làm là bắt buộc' });
    } else if (!DATE_REGEX.test(row.ngayVaoLam)) {
      errors.push({
        field: 'ngayVaoLam',
        message: `Ngày vào làm phải theo định dạng YYYY-MM-DD, nhận được "${row.ngayVaoLam}"`,
      });
    } else {
      const parsed = new Date(row.ngayVaoLam);
      if (isNaN(parsed.getTime())) {
        errors.push({ field: 'ngayVaoLam', message: 'Ngày vào làm không hợp lệ' });
      }
    }

    // luong: optional, must be >= 0 if provided
    if (row.luong !== '' && row.luong !== undefined) {
      const salary = Number(row.luong);
      if (isNaN(salary)) {
        errors.push({ field: 'luong', message: 'Lương phải là số' });
      } else if (salary < 0) {
        errors.push({ field: 'luong', message: 'Lương phải >= 0' });
      }
    }

    return {
      rowIndex,
      raw: row,
      isValid: errors.length === 0,
      errors,
    };
  });
}

// ============================================
// DTO MAPPING
// ============================================

function toCreateEmployeeDto(row: RawEmployeeRow): CreateEmployeeDto {
  return {
    fullName: row.hoTen!,
    email: row.email || undefined,
    phone: row.soDienThoai || undefined,
    departmentCode: row.phongBan!,
    positionTitle: row.chucVu!,
    branch: (row.chiNhanh!.toUpperCase() as Branch),
    joinDate: row.ngayVaoLam!,
    salary: row.luong !== '' && row.luong !== undefined ? Number(row.luong) : undefined,
    bankName: row.nganHang || undefined,
    bankAccount: row.soTaiKhoan || undefined,
    taxCode: row.maSoThue || undefined,
    insuranceId: row.maBaoHiem || undefined,
  };
}

// ============================================
// TEMPLATE DOWNLOAD
// ============================================

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const headers = [
    'hoTen',
    'email',
    'soDienThoai',
    'phongBan',
    'chucVu',
    'chiNhanh',
    'ngayVaoLam',
    'luong',
    'nganHang',
    'soTaiKhoan',
    'maSoThue',
    'maBaoHiem',
  ];

  const examples = [
    [
      'Nguyễn Văn An',
      'an.nguyen@tbs.vn',
      '0901234567',
      'SALES',
      'Nhân viên Kinh doanh',
      'HN',
      '2026-03-01',
      '15000000',
      'Vietcombank',
      '1234567890',
      '1234567890',
      'BH0001',
    ],
    [
      'Trần Thị Bình',
      'binh.tran@tbs.vn',
      '0907654321',
      'ACCOUNTING',
      'Kế toán',
      'HCM',
      '2026-03-15',
      '12000000',
      'Techcombank',
      '0987654321',
      '',
      '',
    ],
    [
      'Lê Minh Tuấn',
      '',
      '',
      'WAREHOUSE',
      'Nhân viên kho',
      'HN',
      '2026-04-01',
      '',
      '',
      '',
      '',
      '',
    ],
  ];

  const wsData = [headers, ...examples];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 20 }, // hoTen
    { wch: 25 }, // email
    { wch: 15 }, // soDienThoai
    { wch: 15 }, // phongBan
    { wch: 25 }, // chucVu
    { wch: 10 }, // chiNhanh
    { wch: 15 }, // ngayVaoLam
    { wch: 15 }, // luong
    { wch: 15 }, // nganHang
    { wch: 18 }, // soTaiKhoan
    { wch: 15 }, // maSoThue
    { wch: 15 }, // maBaoHiem
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'NhanVien');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, 'mau-nhap-nhan-vien.xlsx');
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function NhapExcelNhanSuPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State machine
  const [step, setStep] = useState<Step>('upload');

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Preview state
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitTotal, setSubmitTotal] = useState(0);
  const [submitResults, setSubmitResults] = useState<SubmitResult[]>([]);

  // ============================================
  // FILE PROCESSING
  // ============================================

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File quá lớn. Giới hạn tối đa là 10MB');
      return;
    }

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await parseExcelFile(buffer);

      if (rows.length === 0) {
        toast.error('File Excel không có dữ liệu');
        setIsProcessing(false);
        return;
      }

      const validated = validateRows(rows);
      setValidatedRows(validated);
      setStep('preview');
      toast.success(`Đã đọc ${rows.length} dòng từ file Excel`);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng file.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = useCallback(
    async (rowsToSubmit: ValidatedRow[]) => {
      setStep('submit');
      setIsSubmitting(true);
      setSubmitProgress(0);
      setSubmitTotal(rowsToSubmit.length);
      setSubmitResults([]);

      const results: SubmitResult[] = [];

      for (let i = 0; i < rowsToSubmit.length; i++) {
        const row = rowsToSubmit[i];
        try {
          const dto = toCreateEmployeeDto(row.raw);
          await employeesApi.create(dto);
          results.push({ index: i, row, success: true });
        } catch (err: unknown) {
          const apiErr = err as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          results.push({
            index: i,
            row,
            success: false,
            error:
              apiErr.response?.data?.message ||
              apiErr.message ||
              'Lỗi không xác định',
          });
        }

        setSubmitProgress(i + 1);
        setSubmitResults([...results]);
      }

      setIsSubmitting(false);

      // Invalidate employee list cache
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast.success(`Tạo thành công ${successCount} nhân viên!`);
      } else if (successCount === 0) {
        toast.error(`Tất cả ${failCount} nhân viên đều thất bại`);
      } else {
        toast.warning(`${successCount} thành công, ${failCount} thất bại`);
      }
    },
    [queryClient],
  );

  const handleRetryFailed = useCallback(() => {
    const failedRows = submitResults.filter((r) => !r.success).map((r) => r.row);
    if (failedRows.length > 0) {
      handleSubmit(failedRows);
    }
  }, [submitResults, handleSubmit]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setValidatedRows([]);
    setSubmitResults([]);
    setSubmitProgress(0);
    setSubmitTotal(0);
  }, []);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const totalRows = validatedRows.length;
  const validRows = validatedRows.filter((r) => r.isValid);
  const errorRows = validatedRows.filter((r) => !r.isValid);
  const validCount = validRows.length;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/nhan-su"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="Nhập nhân viên từ Excel"
          description="Upload file Excel để thêm nhiều nhân viên cùng lúc"
          className="pb-0"
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            step === 'upload'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          1
        </span>
        <span className={step === 'upload' ? 'font-medium' : 'text-muted-foreground'}>
          Upload file
        </span>
        <span className="text-muted-foreground">›</span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            step === 'preview'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          2
        </span>
        <span className={step === 'preview' ? 'font-medium' : 'text-muted-foreground'}>
          Xem trước
        </span>
        <span className="text-muted-foreground">›</span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            step === 'submit'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          3
        </span>
        <span className={step === 'submit' ? 'font-medium' : 'text-muted-foreground'}>
          Tạo nhân viên
        </span>
      </div>

      {/* ======================================
          STEP 1: UPLOAD
      ====================================== */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Đang xử lý file...</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-base font-medium mb-1">Kéo thả file Excel vào đây</p>
                <p className="text-sm text-muted-foreground mb-4">
                  hoặc bấm nút bên dưới để chọn file (.xlsx, .xls)
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Chọn file
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Tải file mẫu
                  </Button>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Instructions */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Hướng dẫn nhập liệu</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>
                Bấm <strong>&ldquo;Tải file mẫu&rdquo;</strong> để tải về template Excel có
                sẵn header và dữ liệu ví dụ.
              </li>
              <li>
                Mỗi dòng trong file tương ứng với <strong>1 nhân viên</strong>.
              </li>
              <li>
                Các cột bắt buộc: <strong>hoTen</strong>, <strong>phongBan</strong>,{' '}
                <strong>chucVu</strong>, <strong>chiNhanh</strong>,{' '}
                <strong>ngayVaoLam</strong>.
              </li>
              <li>
                Cột <strong>chiNhanh</strong> phải là <strong>HN</strong> (Hà Nội) hoặc{' '}
                <strong>HCM</strong> (Hồ Chí Minh).
              </li>
              <li>
                Cột <strong>ngayVaoLam</strong> phải theo định dạng{' '}
                <strong>YYYY-MM-DD</strong> (ví dụ: 2026-03-01).
              </li>
              <li>Cột lương phải là số nguyên không âm (đơn vị: VND).</li>
              <li>Tối đa 10MB mỗi file.</li>
            </ul>
          </div>

          {/* Column reference */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Danh sách cột</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: 'hoTen', label: 'Họ tên', required: true },
                { key: 'email', label: 'Email', required: false },
                { key: 'soDienThoai', label: 'Số điện thoại', required: false },
                { key: 'phongBan', label: 'Phòng ban (mã)', required: true },
                { key: 'chucVu', label: 'Chức vụ', required: true },
                { key: 'chiNhanh', label: 'Chi nhánh (HN/HCM)', required: true },
                { key: 'ngayVaoLam', label: 'Ngày vào làm (YYYY-MM-DD)', required: true },
                { key: 'luong', label: 'Lương (VND)', required: false },
                { key: 'nganHang', label: 'Ngân hàng', required: false },
                { key: 'soTaiKhoan', label: 'Số tài khoản', required: false },
                { key: 'maSoThue', label: 'Mã số thuế', required: false },
                { key: 'maBaoHiem', label: 'Mã bảo hiểm', required: false },
              ].map((col) => (
                <div key={col.key} className="flex items-center gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {col.key}
                  </code>
                  <span className="text-muted-foreground">{col.label}</span>
                  {col.required && (
                    <span className="text-destructive font-bold">*</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================
          STEP 2: PREVIEW
      ====================================== */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold">{totalRows}</p>
              <p className="text-xs text-muted-foreground">Tổng dòng</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{validCount}</p>
              <p className="text-xs text-muted-foreground">Hợp lệ</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{errorRows.length}</p>
              <p className="text-xs text-muted-foreground">Lỗi</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{validCount}</p>
              <p className="text-xs text-muted-foreground">Sẽ tạo</p>
            </div>
          </div>

          {/* Error rows table */}
          {errorRows.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">
                  Các dòng bị lỗi ({errorRows.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Dòng
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Họ tên
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Trường lỗi
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Thông báo lỗi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.flatMap((row) =>
                      row.errors.map((err, errIdx) => (
                        <tr
                          key={`${row.rowIndex}-${errIdx}`}
                          className="border-b last:border-0 bg-red-50/50"
                        >
                          <td className="px-4 py-2 font-mono text-xs">
                            {row.rowIndex}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {row.raw.hoTen || '—'}
                          </td>
                          <td className="px-4 py-2">
                            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                              {err.field}
                            </code>
                          </td>
                          <td className="px-4 py-2 text-destructive text-xs">
                            {err.message}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview valid rows */}
          {validRows.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-semibold">
                  Danh sách nhân viên hợp lệ ({validRows.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Dòng
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Họ tên
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Phòng ban
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Chức vụ
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Chi nhánh
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Ngày vào làm
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Lương
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {row.rowIndex}
                        </td>
                        <td className="px-3 py-2 font-medium">{row.raw.hoTen}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.raw.email || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {row.raw.phongBan}
                          </code>
                        </td>
                        <td className="px-3 py-2">{row.raw.chucVu}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                              row.raw.chiNhanh?.toUpperCase() === 'HN'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {row.raw.chiNhanh?.toUpperCase() === 'HN'
                              ? 'Hà Nội'
                              : 'Hồ Chí Minh'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{row.raw.ngayVaoLam}</td>
                        <td className="px-3 py-2 text-right">
                          {row.raw.luong
                            ? Number(row.raw.luong).toLocaleString('vi-VN')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={handleReset}>
              Quay lại
            </Button>
            <Button
              disabled={validCount === 0}
              onClick={() => handleSubmit(validRows)}
              className="gap-2"
            >
              <User className="h-4 w-4" />
              Tạo nhân viên ({validCount})
            </Button>
          </div>
        </div>
      )}

      {/* ======================================
          STEP 3: SUBMIT
      ====================================== */}
      {step === 'submit' && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">
                {isSubmitting
                  ? `Đang tạo... ${submitProgress}/${submitTotal}`
                  : `Hoàn tất ${submitProgress}/${submitTotal}`}
              </span>
              <span className="text-muted-foreground">
                {submitTotal > 0
                  ? Math.round((submitProgress / submitTotal) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    submitTotal > 0
                      ? (submitProgress / submitTotal) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            {!isSubmitting && submitProgress === submitTotal && submitTotal > 0 && (
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {submitResults.filter((r) => r.success).length} thành công
                </span>
                {submitResults.some((r) => !r.success) && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3.5 w-3.5" />
                    {submitResults.filter((r) => !r.success).length} thất bại
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Results list */}
          {submitResults.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Kết quả</h3>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {submitResults.map((result) => (
                  <div
                    key={result.index}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {result.row.raw.hoTen}
                        {result.row.raw.phongBan && (
                          <span className="ml-2 text-muted-foreground font-normal text-xs">
                            {result.row.raw.phongBan}
                          </span>
                        )}
                        <span
                          className={`ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                            result.row.raw.chiNhanh?.toUpperCase() === 'HN'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {result.row.raw.chiNhanh?.toUpperCase() === 'HN'
                            ? 'Hà Nội'
                            : 'Hồ Chí Minh'}
                        </span>
                      </p>
                      {result.error && (
                        <p className="text-xs text-destructive mt-0.5">{result.error}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        result.success
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {result.success ? 'Thành công' : 'Thất bại'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions after submit */}
          {!isSubmitting && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => router.push('/nhan-su')}
              >
                Quay về danh sách
              </Button>
              {submitResults.some((r) => !r.success) && (
                <Button
                  variant="outline"
                  onClick={handleRetryFailed}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Thử lại nhân viên thất bại (
                  {submitResults.filter((r) => !r.success).length})
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
