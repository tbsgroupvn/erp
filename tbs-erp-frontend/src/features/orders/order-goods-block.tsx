'use client';

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
import type { OrderStatus, ServiceType, ClearanceType } from '@/lib/types';
import type { SupplierOrderStatus } from '@/lib/types/enums';

interface OrderGoodsBlockProps {
  order: any;
}

export function OrderGoodsBlock({ order }: OrderGoodsBlockProps) {
  const [expandedSubOrder, setExpandedSubOrder] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Sub Orders with items */}
      {order.subOrders?.map((subOrder: any) => {
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
                    <h4 className="text-sm font-semibold mb-2">Hang hoa ({subOrder.items.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">San pham</th>
                            <th className="pb-2 font-medium text-center">SL</th>
                            <th className="pb-2 font-medium text-right">Don gia</th>
                            <th className="pb-2 font-medium text-right">Thanh tien</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subOrder.items.map((item: any) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-2">
                                <p>{item.productName}</p>
                                {item.productUrl && (
                                  <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                    Link san pham
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
                    <h4 className="text-sm font-semibold mb-2">Kien hang ({subOrder.packages.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Ma kien</th>
                            <th className="pb-2 font-medium text-right">KL TQ (kg)</th>
                            <th className="pb-2 font-medium text-right">KL VN (kg)</th>
                            <th className="pb-2 font-medium text-right">Chenh lech</th>
                            <th className="pb-2 font-medium">Trang thai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subOrder.packages.map((pkg: any) => {
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
                      Anh QC ({subOrder.qcPhotos.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {subOrder.qcPhotos.map((photo: any, idx: number) => (
                        <a
                          key={idx}
                          href={photo.url || photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 w-20 rounded-md border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                        >
                          <img
                            src={typeof photo === 'string' ? photo : photo.thumbnailUrl || photo.url}
                            alt={`QC ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supplier Orders Summary */}
                {subOrder.supplierOrders && subOrder.supplierOrders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Don dat NCC ({subOrder.supplierOrders.length})</h4>
                    <div className="space-y-2">
                      {subOrder.supplierOrders.map((so: any) => (
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
                              ? formatCurrency(so.actualPriceCNY, 'CNY' as any)
                              : so.quotedPriceCNY != null
                                ? formatCurrency(so.quotedPriceCNY, 'CNY' as any)
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
          <p className="text-sm text-muted-foreground">Chua co don con nao</p>
        </div>
      )}
    </div>
  );
}
