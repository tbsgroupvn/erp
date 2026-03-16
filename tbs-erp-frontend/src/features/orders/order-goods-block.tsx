'use client';

import NextImage from 'next/image';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
  SUPPLIER_ORDER_STATUS_LABELS,
  SUPPLIER_ORDER_STATUS_COLORS,
} from '@/lib/utils/constants';
import { formatCurrency, formatWeight } from '@/lib/utils/format';
import { InfoTooltip } from '@/components/shared/info-tooltip';
import type { OrderStatus, ServiceType, ClearanceType, MasterOrder, OrderItem } from '@/lib/types';
import type { SupplierOrderStatus } from '@/lib/types/enums';
import type { Currency } from '@/lib/types/enums';
import type { SupplierOrder } from '@/lib/types';

interface QCPhoto {
  url?: string;
  thumbnailUrl?: string;
}

interface PackageSummary {
  id: string;
  code?: string;
  trackingNumber?: string;
  cnWeight?: number;
  weightCN?: number;
  vnWeight?: number;
  weightVN?: number;
  status?: string;
}

interface SubOrderWithRelations {
  id: string;
  code: string;
  status: string;
  serviceType: string;
  clearanceType: string;
  totalAmount: number;
  currency: Currency;
  items?: OrderItem[];
  packages?: PackageSummary[];
  qcPhotos?: (QCPhoto | string)[];
  supplierOrders?: SupplierOrder[];
}

interface MasterOrderWithGoods extends Omit<MasterOrder, 'subOrders'> {
  subOrders: SubOrderWithRelations[];
}

interface OrderGoodsBlockProps {
  order: MasterOrderWithGoods;
}

export function OrderGoodsBlock({ order }: OrderGoodsBlockProps) {
  const [expandedSubOrder, setExpandedSubOrder] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Sub Orders with items */}
      {order.subOrders?.map((subOrder: SubOrderWithRelations) => {
        const isExpanded = expandedSubOrder === subOrder.id;
        const subStatus = subOrder.status as OrderStatus;
        const clearance = subOrder.clearanceType as ClearanceType;

        return (
          <div key={subOrder.id} className="rounded-lg border bg-card overflow-hidden">
            {/* Sub order header */}
            <button
              type="button"
              onClick={() => setExpandedSubOrder(isExpanded ? null : subOrder.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-semibold">{subOrder.code}</span>
                <StatusBadge
                  label={SERVICE_TYPE_LABELS[subOrder.serviceType as ServiceType] || subOrder.serviceType}
                  colorClass="bg-blue-50 text-blue-700"
                />
                <StatusBadge
                  label={CLEARANCE_TYPE_LABELS[clearance] || clearance}
                  colorClass={CLEARANCE_TYPE_COLORS[clearance] || 'bg-gray-100 text-gray-700'}
                />
                <StatusBadge
                  label={ORDER_STATUS_LABELS[subStatus] || subStatus}
                  colorClass={ORDER_STATUS_COLORS[subStatus] || 'bg-gray-100 text-gray-700'}
                />
              </div>
              <span className="font-medium text-sm">
                {formatCurrency(subOrder.totalAmount, subOrder.currency)}
              </span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t px-6 py-4 space-y-4">
                {/* Items Table */}
                {subOrder.items && subOrder.items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Hàng hóa ({subOrder.items.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Sản phẩm</th>
                            <th className="pb-2 font-medium text-center">SL</th>
                            <th className="pb-2 font-medium text-right">Đơn giá</th>
                            <th className="pb-2 font-medium text-right">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subOrder.items.map((item: OrderItem) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-2">
                                <p>{item.productName}</p>
                                {item.productUrl && (
                                  <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                    Link sản phẩm
                                  </a>
                                )}
                              </td>
                              <td className="py-2 text-center">{item.quantity}</td>
                              <td className="py-2 text-right">{formatCurrency(item.unitPrice, item.currency)}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(item.totalPrice, item.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Packages Table */}
                {subOrder.packages && subOrder.packages.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      Kiện hàng ({subOrder.packages.length})
                      <InfoTooltip tipKey="chargeable-weight" />
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Mã kiện</th>
                            <th className="pb-2 font-medium text-right">
                              <span className="inline-flex items-center justify-end gap-1">
                                KL TQ (kg)
                                <InfoTooltip tipKey="cn-weight" />
                              </span>
                            </th>
                            <th className="pb-2 font-medium text-right">
                              <span className="inline-flex items-center justify-end gap-1">
                                KL VN (kg)
                                <InfoTooltip tipKey="vn-weight" />
                              </span>
                            </th>
                            <th className="pb-2 font-medium text-right">Chênh lệch</th>
                            <th className="pb-2 font-medium">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subOrder.packages.map((pkg: PackageSummary) => {
                            const cnWeight = pkg.cnWeight ?? pkg.weightCN ?? 0;
                            const vnWeight = pkg.vnWeight ?? pkg.weightVN ?? 0;
                            const variance = cnWeight > 0 ? ((vnWeight - cnWeight) / cnWeight * 100) : 0;
                            return (
                              <tr key={pkg.id} className="border-b">
                                <td className="py-2 font-medium">{pkg.code || pkg.trackingNumber || '---'}</td>
                                <td className="py-2 text-right">{formatWeight(cnWeight)}</td>
                                <td className="py-2 text-right">{formatWeight(vnWeight)}</td>
                                <td className={`py-2 text-right ${Math.abs(variance) > 5 ? 'text-destructive font-medium' : ''}`}>
                                  {variance !== 0 ? `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%` : '---'}
                                </td>
                                <td className="py-2">
                                  {pkg.status && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">
                                      {pkg.status}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* QC Gallery Thumbnails */}
                {subOrder.qcPhotos && subOrder.qcPhotos.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Ảnh QC ({subOrder.qcPhotos.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {subOrder.qcPhotos.map((photo: QCPhoto | string, idx: number) => (
                        <a
                          key={idx}
                          href={typeof photo === 'string' ? photo : (photo.url ?? '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 w-20 rounded-md border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                        >
                          <NextImage
                            src={typeof photo === 'string' ? photo : (photo.thumbnailUrl || photo.url || '')}
                            alt={`QC ${idx + 1}`}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supplier Orders Summary */}
                {subOrder.supplierOrders && subOrder.supplierOrders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      Đơn đặt NCC ({subOrder.supplierOrders.length})
                      <InfoTooltip tipKey="supplier-order" />
                    </h4>
                    <div className="space-y-2">
                      {subOrder.supplierOrders.map((so: SupplierOrder) => (
                        <div key={so.id} className="flex items-center justify-between rounded-md border p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{so.code}</span>
                            <span className="text-xs text-muted-foreground">{so.supplierName}</span>
                            <StatusBadge
                              label={SUPPLIER_ORDER_STATUS_LABELS[so.status as SupplierOrderStatus] || so.status}
                              colorClass={SUPPLIER_ORDER_STATUS_COLORS[so.status as SupplierOrderStatus] || 'bg-gray-100 text-gray-700'}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {so.actualPriceCNY != null
                              ? formatCurrency(so.actualPriceCNY, 'CNY')
                              : so.quotedPriceCNY != null
                                ? formatCurrency(so.quotedPriceCNY, 'CNY')
                                : '---'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(!order.subOrders || order.subOrders.length === 0) && (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Chưa có đơn con nào</p>
        </div>
      )}
    </div>
  );
}
