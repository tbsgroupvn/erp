'use client';

import { useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { masterOrdersApi } from '@/lib/api/orders.api';
import { customersApi } from '@/lib/api/customers.api';
import { masterOrderKeys } from '@/lib/hooks/use-orders';
import {
  SERVICE_TYPE_LABELS,
  BRANCH_LABELS,
  CLEARANCE_TYPE_LABELS,
  SHIPPING_ROUTE_LABELS,
  CURRENCY_SYMBOLS,
} from '@/lib/utils/constants';
import {
  parseExcelFile,
  validateRows,
  groupRowsIntoMasterOrders,
  toCreateMasterOrderDto,
  downloadTemplate,
} from '@/lib/utils/excel-import';
import type {
  ValidatedRow,
  GroupedMasterOrder,
} from '@/lib/utils/excel-import';
import type { Customer, CreateMasterOrderDto } from '@/lib/types';
import type { ServiceType, ShippingRoute, ClearanceType } from '@/lib/types/enums';

// ============================================
// TYPES
// ============================================

type Step = 'upload' | 'preview' | 'submit';

interface SubmitResult {
  index: number;
  group: GroupedMasterOrder;
  success: boolean;
  error?: string;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function NhapExcelPage() {
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
  const [groups, setGroups] = useState<GroupedMasterOrder[]>([]);
  const [customerMap, setCustomerMap] = useState<Map<string, Customer>>(
    new Map(),
  );
  const [unresolvedCodes, setUnresolvedCodes] = useState<Set<string>>(
    new Set(),
  );

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitTotal, setSubmitTotal] = useState(0);
  const [submitResults, setSubmitResults] = useState<SubmitResult[]>([]);

  // ============================================
  // CUSTOMER RESOLUTION
  // ============================================

  const resolveCustomers = useCallback(
    async (rows: ValidatedRow[]): Promise<{
      map: Map<string, Customer>;
      unresolved: Set<string>;
    }> => {
      const codes = new Set<string>();
      for (const row of rows) {
        if (row.isValid && row.data.maKhachHang) {
          codes.add(row.data.maKhachHang);
        }
      }

      const map = new Map<string, Customer>();
      const unresolved = new Set<string>();

      for (const code of codes) {
        try {
          const result = await customersApi.list({ search: code, limit: 5 });
          const match = result.data?.find(
            (c: Customer) => c.code === code,
          );
          if (match) {
            map.set(code, match);
          } else {
            unresolved.add(code);
          }
        } catch {
          unresolved.add(code);
        }
      }

      return { map, unresolved };
    },
    [],
  );

  // ============================================
  // FILE PROCESSING
  // ============================================

  const processFile = useCallback(
    async (file: File) => {
      if (
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls')
      ) {
        toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
        return;
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File quá lớn. Giới hạn 10MB');
        return;
      }

      setIsProcessing(true);
      try {
        const buffer = await file.arrayBuffer();
        const rows = parseExcelFile(buffer);

        if (rows.length === 0) {
          toast.error('File Excel không có dữ liệu');
          setIsProcessing(false);
          return;
        }

        const validated = validateRows(rows);
        setValidatedRows(validated);

        // Resolve customers
        const { map, unresolved } = await resolveCustomers(validated);
        setCustomerMap(map);
        setUnresolvedCodes(unresolved);

        // Mark rows with unresolved customer codes as invalid
        for (const row of validated) {
          if (
            row.isValid &&
            row.data.maKhachHang &&
            unresolved.has(row.data.maKhachHang)
          ) {
            row.isValid = false;
            row.errors.push({
              field: 'maKhachHang',
              message: `Không tìm thấy khách hàng với mã "${row.data.maKhachHang}"`,
            });
          }
        }

        const grouped = groupRowsIntoMasterOrders(validated);
        setGroups(grouped);

        setStep('preview');
        toast.success(`Đã đọc ${rows.length} dòng từ file Excel`);
      } catch (err) {
        console.error(err);
        toast.error('Lỗi đọc file Excel. Vui lòng kiểm tra lại file.');
      } finally {
        setIsProcessing(false);
      }
    },
    [resolveCustomers],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
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
    async (groupsToSubmit: GroupedMasterOrder[]) => {
      setStep('submit');
      setIsSubmitting(true);
      setSubmitProgress(0);
      setSubmitTotal(groupsToSubmit.length);
      setSubmitResults([]);

      const results: SubmitResult[] = [];

      for (let i = 0; i < groupsToSubmit.length; i++) {
        const group = groupsToSubmit[i];
        const customer = customerMap.get(group.maKhachHang);

        if (!customer) {
          results.push({
            index: i,
            group,
            success: false,
            error: `Không tìm thấy khách hàng "${group.maKhachHang}"`,
          });
          setSubmitProgress(i + 1);
          setSubmitResults([...results]);
          continue;
        }

        try {
          const dto: CreateMasterOrderDto = toCreateMasterOrderDto(
            group,
            customer.id,
          );
          await masterOrdersApi.create(dto);
          results.push({ index: i, group, success: true });
        } catch (err: any) {
          results.push({
            index: i,
            group,
            success: false,
            error:
              err.response?.data?.message ||
              err.message ||
              'Lỗi không xác định',
          });
        }

        setSubmitProgress(i + 1);
        setSubmitResults([...results]);
      }

      setIsSubmitting(false);

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: masterOrderKeys.lists() });

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast.success(`Tạo thành công ${successCount} đơn hàng!`);
      } else if (successCount === 0) {
        toast.error(`Tất cả ${failCount} đơn hàng đều thất bại`);
      } else {
        toast.warning(
          `${successCount} đơn thành công, ${failCount} đơn thất bại`,
        );
      }
    },
    [customerMap, queryClient],
  );

  const handleRetryFailed = useCallback(() => {
    const failedGroups = submitResults
      .filter((r) => !r.success)
      .map((r) => r.group);
    if (failedGroups.length > 0) {
      handleSubmit(failedGroups);
    }
  }, [submitResults, handleSubmit]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setValidatedRows([]);
    setGroups([]);
    setCustomerMap(new Map());
    setUnresolvedCodes(new Set());
    setSubmitResults([]);
    setSubmitProgress(0);
    setSubmitTotal(0);
  }, []);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const totalRows = validatedRows.length;
  const validRows = validatedRows.filter((r) => r.isValid).length;
  const errorRows = validatedRows.filter((r) => !r.isValid);
  const validGroupCount = groups.length;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/don-hang"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="Nhập đơn hàng từ Excel"
          description="Upload file Excel để tạo nhiều đơn hàng cùng lúc"
          className="pb-0"
        />
      </div>

      {/* Step 1: Upload */}
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
                <p className="text-sm text-muted-foreground">
                  Đang xử lý file...
                </p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-base font-medium mb-1">
                  Kéo thả file Excel vào đây
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  hoặc bấm nút bên dưới để chọn file (.xlsx, .xls)
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
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
            <h3 className="text-sm font-semibold mb-2">Hướng dẫn</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                Mỗi dòng trong file là 1 sản phẩm. Các dòng cùng{' '}
                <strong>mã khách hàng + chi nhánh</strong> sẽ được gộp
                thành 1 đơn tổng.
              </li>
              <li>
                Các dòng cùng <strong>loại dịch vụ + thông quan + tuyến</strong>{' '}
                sẽ được gộp thành 1 đơn con.
              </li>
              <li>
                Bấm <strong>&ldquo;Tải file mẫu&rdquo;</strong> để tải template có
                sẵn header và dữ liệu ví dụ.
              </li>
              <li>
                Cột <strong>maKhachHang</strong> phải trùng với mã khách
                hàng đã có trong hệ thống.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold">{totalRows}</p>
              <p className="text-xs text-muted-foreground">Tổng dòng</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {validRows}
              </p>
              <p className="text-xs text-muted-foreground">Hợp lệ</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-red-600">
                {errorRows.length}
              </p>
              <p className="text-xs text-muted-foreground">Lỗi</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {validGroupCount}
              </p>
              <p className="text-xs text-muted-foreground">Đơn sẽ tạo</p>
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
                        Trường
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Lỗi
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
                          <td className="px-4 py-2 font-mono">
                            {row.rowIndex}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {err.field}
                          </td>
                          <td className="px-4 py-2 text-destructive">
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

          {/* Preview groups */}
          {groups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                Preview đơn hàng ({groups.length})
              </h3>
              {groups.map((group, gIdx) => {
                const customer = customerMap.get(group.maKhachHang);
                return (
                  <div
                    key={gIdx}
                    className="rounded-lg border bg-card overflow-hidden"
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                      <span className="text-sm font-semibold">
                        {group.maKhachHang}
                      </span>
                      {customer && (
                        <span className="text-sm text-muted-foreground">
                          — {customer.fullName}
                        </span>
                      )}
                      <StatusBadge
                        label={BRANCH_LABELS[group.chiNhanh]}
                        colorClass={
                          group.chiNhanh === 'HN'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }
                      />
                      <span className="ml-auto text-xs text-muted-foreground">
                        {group.subOrders.length} đơn con
                      </span>
                    </div>

                    {/* Sub orders */}
                    <div className="divide-y">
                      {group.subOrders.map((sub, sIdx) => (
                        <div key={sIdx} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge
                              label={
                                SERVICE_TYPE_LABELS[
                                  sub.loaiDichVu as ServiceType
                                ]
                              }
                              colorClass="bg-blue-50 text-blue-700"
                            />
                            <StatusBadge
                              label={
                                CLEARANCE_TYPE_LABELS[
                                  sub.thongQuan as ClearanceType
                                ]
                              }
                              colorClass={
                                sub.thongQuan === 'CHINH_NGACH'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }
                            />
                            {sub.tuyenVanChuyen && (
                              <StatusBadge
                                label={
                                  SHIPPING_ROUTE_LABELS[
                                    sub.tuyenVanChuyen as ShippingRoute
                                  ]
                                }
                                colorClass="bg-purple-50 text-purple-700"
                              />
                            )}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">
                                  Sản phẩm
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">
                                  SL
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">
                                  Đơn giá
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">
                                  Tiền tệ
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sub.items.map((item, iIdx) => (
                                <tr
                                  key={iIdx}
                                  className="border-b last:border-0"
                                >
                                  <td className="px-2 py-1">
                                    {item.tenSanPham}
                                    {item.linkSanPham && (
                                      <a
                                        href={item.linkSanPham}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 text-xs text-blue-500 hover:underline"
                                      >
                                        (link)
                                      </a>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {item.soLuong}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {item.donGia.toLocaleString('vi-VN')}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {CURRENCY_SYMBOLS[item.donViTien] ||
                                      item.donViTien}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={handleReset}>
              Quay lại
            </Button>
            <Button
              disabled={validGroupCount === 0}
              onClick={() => handleSubmit(groups)}
              className="gap-2"
            >
              Tạo đơn hàng ({validGroupCount} đơn)
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Submit */}
      {step === 'submit' && (
        <div className="space-y-4">
          {/* Progress */}
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
                  width: `${submitTotal > 0 ? (submitProgress / submitTotal) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Results */}
          {submitResults.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Kết quả</h3>
              </div>
              <div className="divide-y">
                {submitResults.map((result) => {
                  const customer = customerMap.get(
                    result.group.maKhachHang,
                  );
                  return (
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
                          {result.group.maKhachHang}
                          {customer && ` — ${customer.fullName}`}
                          <span className="ml-2 text-muted-foreground">
                            ({BRANCH_LABELS[result.group.chiNhanh]})
                          </span>
                        </p>
                        {result.error && (
                          <p className="text-xs text-destructive mt-0.5">
                            {result.error}
                          </p>
                        )}
                      </div>
                      <StatusBadge
                        label={
                          result.success ? 'Thành công' : 'Thất bại'
                        }
                        colorClass={
                          result.success
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions after submit */}
          {!isSubmitting && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => router.push('/don-hang')}
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
                  Thử lại đơn thất bại
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
