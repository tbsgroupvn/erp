'use client';

import { Clock, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';

interface OrderAuditLogProps {
  order: any;
}

export function OrderAuditLog({ order }: OrderAuditLogProps) {
  // Collect audit logs from multiple sources
  const auditLogs: any[] = [];

  // Status history from sub orders
  if (order.subOrders) {
    for (const subOrder of order.subOrders) {
      if (subOrder.statusHistory) {
        for (const h of subOrder.statusHistory) {
          auditLogs.push({
            id: h.id,
            action: 'STATUS_CHANGE',
            description: `${subOrder.code}: ${h.fromStatus ? `${h.fromStatus} -> ` : ''}${h.toStatus}`,
            note: h.note,
            user: h.changedBy || h.user,
            createdAt: h.createdAt,
          });
        }
      }
    }
  }

  // Direct audit logs from order
  if (order.auditLogs) {
    for (const log of order.auditLogs) {
      auditLogs.push({
        id: log.id,
        action: log.action || log.eventType,
        description: log.description || log.message,
        note: log.detail || log.changes,
        user: log.user || log.performedBy,
        createdAt: log.createdAt || log.timestamp,
      });
    }
  }

  // Sort by date descending
  auditLogs.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  if (auditLogs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Chua co nhat ky hoat dong</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Nhat ky hoat dong</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {auditLogs.map((log, index) => (
            <div key={log.id || index} className="relative flex gap-4 pl-10">
              {/* Timeline dot */}
              <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />

              <div className="flex-1 rounded-md border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {/* Action badge */}
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted mr-2">
                      {formatAction(log.action)}
                    </span>
                    <span className="text-sm">{log.description}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>

                {log.note && (
                  <p className="text-xs text-muted-foreground">{typeof log.note === 'string' ? log.note : JSON.stringify(log.note)}</p>
                )}

                {log.user && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>
                      {typeof log.user === 'string'
                        ? log.user
                        : log.user.fullName || log.user.email || '---'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    STATUS_CHANGE: 'Doi trang thai',
    CREATED: 'Tao moi',
    UPDATED: 'Cap nhat',
    DELETED: 'Xoa',
    PAYMENT: 'Thanh toan',
    ASSIGNED: 'Phan cong',
    COMMENT: 'Binh luan',
    DOCUMENT_UPLOAD: 'Tai tai lieu',
    APPROVAL: 'Phe duyet',
  };
  return labels[action] || action;
}
