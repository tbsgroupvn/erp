'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PackageCheck, Truck, X, CheckCircle, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeliveryPlan, useDispatchDelivery, useConfirmDelivery } from '@/lib/hooks/use-warehouse';
import { useDrivers, useDriverDeliveries } from '@/lib/hooks/use-drivers';
import { useRecordCODCollection } from '@/lib/hooks/use-cod';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { BRANCH_LABELS } from '@/lib/utils/constants';
import { Branch, UserRole } from '@/lib/types';
import type { Package } from '@/lib/types';

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ giao',
  DISPATCHED: 'Đã phân công',
  PICKED_UP: 'Đã lấy',
  DELIVERING: 'Đang giao',
  DELIVERED: 'Đã giao',
  FAILED: 'Thất bại',
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  DISPATCHED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-cyan-100 text-cyan-700',
  DELIVERING: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const dispatchSchema = z.object({
  orderId: z.string().min(1, 'Bắt buộc'),
  driverId: z.string().min(1, 'Chọn tài xế'),
  vehicleId: z.string().min(1, 'Nhập mã xe'),
  recipientName: z.string().min(1, 'Bắt buộc'),
  recipientPhone: z.string().min(1, 'Bắt buộc'),
  deliveryAddress: z.string().min(1, 'Bắt buộc'),
  scheduledAt: z.string().optional(),
  codAmount: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
});

type DispatchForm = z.infer<typeof dispatchSchema>;

const confirmSchema = z.object({
  receivedBy: z.string().min(1, 'Bắt buộc'),
  notes: z.string().optional(),
});
type ConfirmForm = z.infer<typeof confirmSchema>;

const codSchema = z.object({
  amount: z.coerce.number().min(1, 'Số tiền phải > 0'),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});
type CODForm = z.infer<typeof codSchema>;

export default function GiaoHangPage() {
  const user = useAuthStore((s) => s.user);
  const isDriver = user?.role === UserRole.DRIVER;
  const userBranch = user?.branch as Branch;

  const [selectedBranch, setSelectedBranch] = useState<Branch>(userBranch || Branch.HN);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [codCollectId, setCodCollectId] = useState<string | null>(null);

  const { data: plan, isLoading } = useDeliveryPlan(selectedBranch);
  const { data: driversData } = useDrivers({ branch: selectedBranch, status: 'ACTIVE' as any });
  const { data: myDeliveries } = useDriverDeliveries(user?.id ?? '', {});
  const dispatchMutation = useDispatchDelivery();
  const confirmMutation = useConfirmDelivery();
  const codMutation = useRecordCODCollection();

  const drivers = driversData?.data ?? [];
  const driverDeliveries = (myDeliveries as any)?.data ?? [];

  const dispatchForm = useForm<DispatchForm>({
    resolver: zodResolver(dispatchSchema),
  });

  const confirmForm = useForm<ConfirmForm>({
    resolver: zodResolver(confirmSchema),
  });

  const codForm = useForm<CODForm>({
    resolver: zodResolver(codSchema),
  });

  const onDispatch = (data: DispatchForm) => {
    dispatchMutation.mutate(
      {
        ...data,
        codAmount: data.codAmount || undefined,
        scheduledAt: data.scheduledAt || undefined,
        note: data.note || undefined,
      },
      {
        onSuccess: () => {
          dispatchForm.reset();
          setShowDispatchForm(false);
          setSelectedPackages(new Set());
        },
      },
    );
  };

  const onConfirm = (data: ConfirmForm) => {
    if (!confirmingId) return;
    confirmMutation.mutate(
      {
        deliveryId: confirmingId,
        data: { receivedBy: data.receivedBy, notes: data.notes || undefined },
      },
      {
        onSuccess: () => {
          confirmForm.reset();
          setConfirmingId(null);
        },
      },
    );
  };

  const onCODCollect = (data: CODForm) => {
    if (!codCollectId) return;
    codMutation.mutate(
      {
        deliveryId: codCollectId,
        amount: data.amount,
        paymentMethod: data.paymentMethod || undefined,
        notes: data.notes || undefined,
      },
      {
        onSuccess: () => {
          codForm.reset();
          setCodCollectId(null);
        },
      },
    );
  };

  const togglePackage = (id: string) => {
    setSelectedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const packages = plan?.packages ?? [];
  const readyPackages = packages.filter((p: Package) => p.warehouseVNStatus === 'READY');

  // Driver view
  if (isDriver) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chuyến giao của tôi"
          description="Danh sách chuyến giao được phân công"
        />

        {/* Driver delivery list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Chuyến giao ({driverDeliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driverDeliveries.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                Chưa có chuyến giao nào
              </p>
            ) : (
              <div className="space-y-4">
                {driverDeliveries.map((delivery: any) => (
                  <div key={delivery.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{delivery.code || delivery.id?.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {delivery.recipientName} - {delivery.recipientPhone}
                        </p>
                        <p className="text-sm text-muted-foreground">{delivery.deliveryAddress}</p>
                      </div>
                      <StatusBadge
                        label={DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}
                        colorClass={DELIVERY_STATUS_COLORS[delivery.status] || 'bg-gray-100 text-gray-700'}
                      />
                    </div>

                    {delivery.codAmount > 0 && (
                      <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm">
                        <DollarSign className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-700">
                          COD: {formatCurrency(delivery.codAmount)}
                        </span>
                        {delivery.codCollected && (
                          <span className="ml-auto text-green-600 text-xs font-medium">Đã thu</span>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {delivery.scheduledAt && <span>Hẹn: {formatDate(delivery.scheduledAt)}</span>}
                    </div>

                    {/* Action buttons for driver */}
                    {delivery.status !== 'DELIVERED' && delivery.status !== 'FAILED' && (
                      <div className="flex gap-2">
                        {/* Confirm delivery */}
                        {confirmingId === delivery.id ? (
                          <form
                            onSubmit={confirmForm.handleSubmit(onConfirm)}
                            className="flex-1 space-y-2 rounded-md border p-3 bg-green-50"
                          >
                            <p className="text-sm font-medium text-green-700">Xác nhận giao hàng</p>
                            <div>
                              <Label className="text-xs">Người nhận *</Label>
                              <Input
                                {...confirmForm.register('receivedBy')}
                                placeholder="Tên người nhận hàng"
                                className="h-8 text-sm"
                              />
                              {confirmForm.formState.errors.receivedBy && (
                                <p className="text-xs text-red-500 mt-0.5">
                                  {confirmForm.formState.errors.receivedBy.message}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">Ghi chú</Label>
                              <Input
                                {...confirmForm.register('notes')}
                                placeholder="Ghi chú"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" type="submit" disabled={confirmMutation.isPending}>
                                {confirmMutation.isPending ? '...' : 'Xác nhận'}
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => setConfirmingId(null)}
                              >
                                Hủy
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setConfirmingId(delivery.id);
                              setCodCollectId(null);
                            }}
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            Xác nhận giao
                          </Button>
                        )}

                        {/* COD collection */}
                        {delivery.codAmount > 0 && !delivery.codCollected && (
                          <>
                            {codCollectId === delivery.id ? (
                              <form
                                onSubmit={codForm.handleSubmit(onCODCollect)}
                                className="flex-1 space-y-2 rounded-md border p-3 bg-amber-50"
                              >
                                <p className="text-sm font-medium text-amber-700">Thu tiền COD</p>
                                <div>
                                  <Label className="text-xs">Số tiền *</Label>
                                  <Input
                                    type="number"
                                    {...codForm.register('amount')}
                                    defaultValue={delivery.codAmount}
                                    className="h-8 text-sm"
                                  />
                                  {codForm.formState.errors.amount && (
                                    <p className="text-xs text-red-500 mt-0.5">
                                      {codForm.formState.errors.amount.message}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs">Phương thức</Label>
                                  <select
                                    {...codForm.register('paymentMethod')}
                                    className="flex h-8 w-full rounded-md border bg-background px-2 text-sm"
                                  >
                                    <option value="CASH">Tiền mặt</option>
                                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                                  </select>
                                </div>
                                <div>
                                  <Label className="text-xs">Ghi chú</Label>
                                  <Input
                                    {...codForm.register('notes')}
                                    placeholder="Ghi chú"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" type="submit" disabled={codMutation.isPending}>
                                    {codMutation.isPending ? '...' : 'Thu tiền'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCodCollectId(null)}
                                  >
                                    Hủy
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                onClick={() => {
                                  setCodCollectId(delivery.id);
                                  setConfirmingId(null);
                                  codForm.setValue('amount', delivery.codAmount);
                                }}
                              >
                                <DollarSign className="mr-1 h-3.5 w-3.5" />
                                Thu COD
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Warehouse manager view
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kế hoạch giao hàng"
        description="Quản lý phân công giao hàng theo chi nhánh"
      >
        <Button
          onClick={() => setShowDispatchForm((v) => !v)}
          variant={showDispatchForm ? 'outline' : 'default'}
        >
          {showDispatchForm ? (
            <>
              <X className="mr-2 h-4 w-4" /> Đóng
            </>
          ) : (
            <>
              <Truck className="mr-2 h-4 w-4" /> Tạo chuyến giao
            </>
          )}
        </Button>
      </PageHeader>

      {/* Branch selector */}
      <div className="flex items-center gap-3">
        <Label>Chi nhánh:</Label>
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value as Branch)}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(BRANCH_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Dispatch form */}
      {showDispatchForm && (
        <Card>
          <CardHeader>
            <CardTitle>Tạo chuyến giao mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={dispatchForm.handleSubmit(onDispatch)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Mã đơn hàng *</Label>
                  <Input {...dispatchForm.register('orderId')} placeholder="Nhập mã đơn hàng" />
                  {dispatchForm.formState.errors.orderId && (
                    <p className="text-xs text-red-500 mt-1">
                      {dispatchForm.formState.errors.orderId.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Tài xế *</Label>
                  <select
                    {...dispatchForm.register('driverId')}
                    className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Chọn tài xế --</option>
                    {drivers.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} - {d.phone}
                      </option>
                    ))}
                  </select>
                  {dispatchForm.formState.errors.driverId && (
                    <p className="text-xs text-red-500 mt-1">
                      {dispatchForm.formState.errors.driverId.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Mã xe *</Label>
                  <Input {...dispatchForm.register('vehicleId')} placeholder="Nhập mã xe" />
                  {dispatchForm.formState.errors.vehicleId && (
                    <p className="text-xs text-red-500 mt-1">
                      {dispatchForm.formState.errors.vehicleId.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Người nhận *</Label>
                  <Input {...dispatchForm.register('recipientName')} placeholder="Họ tên người nhận" />
                  {dispatchForm.formState.errors.recipientName && (
                    <p className="text-xs text-red-500 mt-1">
                      {dispatchForm.formState.errors.recipientName.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>SĐT người nhận *</Label>
                  <Input {...dispatchForm.register('recipientPhone')} placeholder="Số điện thoại" />
                  {dispatchForm.formState.errors.recipientPhone && (
                    <p className="text-xs text-red-500 mt-1">
                      {dispatchForm.formState.errors.recipientPhone.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Địa chỉ giao *</Label>
                  <Input
                    {...dispatchForm.register('deliveryAddress')}
                    placeholder="Địa chỉ giao hàng"
                  />
                  {dispatchForm.formState.errors.deliveryAddress && (
                    <p className="text-xs text-red-500 mt-1">
                      {dispatchForm.formState.errors.deliveryAddress.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Ngày giao dự kiến</Label>
                  <Input type="date" {...dispatchForm.register('scheduledAt')} />
                </div>
                <div>
                  <Label>Số tiền COD</Label>
                  <Input type="number" {...dispatchForm.register('codAmount')} placeholder="0" />
                </div>
                <div>
                  <Label>Ghi chú</Label>
                  <Input {...dispatchForm.register('note')} placeholder="Ghi chú" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={dispatchMutation.isPending}>
                  {dispatchMutation.isPending ? 'Đang xử lý...' : 'Tạo chuyến giao'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDispatchForm(false)}
                >
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{plan?.totalPackages ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Tổng kiện</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{readyPackages.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Sẵn sàng giao</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{plan?.totalWeight?.toFixed(1) ?? 0} kg</p>
              <p className="text-sm text-muted-foreground mt-1">Tổng trọng lượng</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Package list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Kiện hàng chờ giao ({readyPackages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Đang tải...</p>
          ) : readyPackages.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Không có kiện hàng sẵn sàng giao
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-3 font-medium w-8" />
                    <th className="pb-2 pr-3 font-medium">Mã kiện</th>
                    <th className="pb-2 pr-3 font-medium">Đơn hàng</th>
                    <th className="pb-2 pr-3 font-medium">Cân nặng</th>
                    <th className="pb-2 pr-3 font-medium">TL tính phí</th>
                    <th className="pb-2 pr-3 font-medium">Trạng thái</th>
                    <th className="pb-2 font-medium">Nhận VN</th>
                  </tr>
                </thead>
                <tbody>
                  {readyPackages.map((pkg: Package) => (
                    <tr key={pkg.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedPackages.has(pkg.id)}
                          onChange={() => togglePackage(pkg.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-2 pr-3 font-medium">{pkg.code}</td>
                      <td className="py-2 pr-3">{pkg.orderId}</td>
                      <td className="py-2 pr-3">{pkg.actualWeight?.toFixed(2) ?? '---'} kg</td>
                      <td className="py-2 pr-3">
                        {pkg.chargeableWeight?.toFixed(2) ?? '---'} kg
                      </td>
                      <td className="py-2 pr-3">
                        <StatusBadge
                          label="Sẵn sàng giao"
                          colorClass="bg-amber-100 text-amber-700"
                        />
                      </td>
                      <td className="py-2">
                        {pkg.receivedVNAt ? formatDate(pkg.receivedVNAt) : '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedPackages.size > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-md bg-blue-50 p-3">
              <span className="text-sm font-medium">
                Đã chọn {selectedPackages.size} kiện
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
