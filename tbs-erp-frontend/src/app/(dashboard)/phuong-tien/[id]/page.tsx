'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wrench, Fuel, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useVehicle, useVehicleMaintenance, useVehicleFuelRecords, useCreateFuelRecord } from '@/lib/hooks/use-fleet';
import {
  VEHICLE_TYPE_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_COLORS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import type { VehicleType, VehicleStatus, Branch } from '@/lib/types/enums';

export default function VehicleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: vehicle, isLoading } = useVehicle(id);
  const { data: maintenance } = useVehicleMaintenance(id);
  const { data: fuelRecords } = useVehicleFuelRecords(id);
  const createFuel = useCreateFuelRecord();

  const [showFuelForm, setShowFuelForm] = useState(false);
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!vehicle) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy phương tiện</p>
        <Link href="/phuong-tien" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const handleFuelSubmit = () => {
    createFuel.mutate(
      {
        vehicleId: id,
        data: {
          liters: Number(fuelLiters),
          cost: Number(fuelCost),
          odometer: Number(fuelOdometer),
          date: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          setShowFuelForm(false);
          setFuelLiters('');
          setFuelCost('');
          setFuelOdometer('');
        },
      },
    );
  };

  const vehicleStatus = vehicle.status as VehicleStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/phuong-tien" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{vehicle.plateNumber}</h1>
            <StatusBadge
              label={VEHICLE_STATUS_LABELS[vehicleStatus] || vehicleStatus}
              colorClass={VEHICLE_STATUS_COLORS[vehicleStatus] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
            <Wrench className="h-4 w-4" /> Lên lịch bảo dưỡng
          </button>
          <button
            onClick={() => setShowFuelForm(!showFuelForm)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Fuel className="h-4 w-4" /> Ghi nhiên liệu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin xe</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại xe</dt>
              <dd>{VEHICLE_TYPE_LABELS[vehicle.type as VehicleType] || vehicle.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hãng / Mẫu xe</dt>
              <dd>{vehicle.brand} {vehicle.model}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tải trọng</dt>
              <dd>{vehicle.capacityKg.toLocaleString('vi-VN')} kg</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chi nhánh</dt>
              <dd>{BRANCH_LABELS[vehicle.branch as Branch] || vehicle.branch}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Trạng thái</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd>
                <StatusBadge
                  label={VEHICLE_STATUS_LABELS[vehicleStatus] || vehicleStatus}
                  colorClass={VEHICLE_STATUS_COLORS[vehicleStatus] || 'bg-gray-100 text-gray-700'}
                />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Hạn sử dụng</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hạn bảo hiểm</dt>
              <dd className={vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < new Date() ? 'text-red-600 font-medium' : ''}>
                {vehicle.insuranceExpiry ? formatDate(vehicle.insuranceExpiry, 'dd/MM/yyyy') : '---'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hạn đăng kiểm</dt>
              <dd className={vehicle.registrationExpiry && new Date(vehicle.registrationExpiry) < new Date() ? 'text-red-600 font-medium' : ''}>
                {vehicle.registrationExpiry ? formatDate(vehicle.registrationExpiry, 'dd/MM/yyyy') : '---'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Fuel form */}
      {showFuelForm && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Ghi nhận nhiên liệu</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium">Số lít</p>
              <input
                type="number"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
                className="flex h-9 w-32 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Chi phí (VND)</p>
              <input
                type="number"
                value={fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
                className="flex h-9 w-40 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Số km đồng hồ</p>
              <input
                type="number"
                value={fuelOdometer}
                onChange={(e) => setFuelOdometer(e.target.value)}
                className="flex h-9 w-32 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleFuelSubmit}
              disabled={createFuel.isPending || !fuelLiters || !fuelCost}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createFuel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu
            </button>
          </div>
        </div>
      )}

      {/* Maintenance History */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Lịch sử bảo dưỡng</h3>
        {maintenance && maintenance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Loại</th>
                  <th className="pb-2 font-medium">Mô tả</th>
                  <th className="pb-2 font-medium text-right">Chi phí</th>
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium">Lần tiếp</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2">{m.type}</td>
                    <td className="py-2">{m.description}</td>
                    <td className="py-2 text-right">{formatCurrency(m.cost)}</td>
                    <td className="py-2">{formatDate(m.date, 'dd/MM/yyyy')}</td>
                    <td className="py-2">{m.nextDate ? formatDate(m.nextDate, 'dd/MM/yyyy') : '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có lịch sử bảo dưỡng</p>
        )}
      </div>

      {/* Fuel Records */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Nhật ký nhiên liệu</h3>
        {fuelRecords && fuelRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium text-right">Số lít</th>
                  <th className="pb-2 font-medium text-right">Chi phí</th>
                  <th className="pb-2 font-medium text-right">Số km đồng hồ</th>
                </tr>
              </thead>
              <tbody>
                {fuelRecords.map((f) => (
                  <tr key={f.id} className="border-b">
                    <td className="py-2">{formatDate(f.date, 'dd/MM/yyyy')}</td>
                    <td className="py-2 text-right">{f.liters}</td>
                    <td className="py-2 text-right">{formatCurrency(f.cost)}</td>
                    <td className="py-2 text-right">{f.odometer.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có nhật ký nhiên liệu</p>
        )}
      </div>
    </div>
  );
}
