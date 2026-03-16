'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils/format';
import type { ComplianceAlert } from '@/lib/types/customs.types';

interface ComplianceAlertsCardProps {
  alerts: ComplianceAlert[];
  isAcknowledgePending: boolean;
  onAcknowledge: (alertId: string) => void;
}

export function ComplianceAlertsCard({
  alerts,
  isAcknowledgePending,
  onAcknowledge,
}: ComplianceAlertsCardProps) {
  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Cảnh báo tuân thủ ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => {
            const severityClass =
              alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                ? 'border-red-200 bg-red-50'
                : alert.severity === 'MEDIUM'
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-blue-200 bg-blue-50';
            const severityText =
              alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                ? 'text-red-800'
                : alert.severity === 'MEDIUM'
                  ? 'text-yellow-800'
                  : 'text-blue-800';

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${severityClass}`}
              >
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severityText}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase ${severityText}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{alert.alertType}</span>
                    {alert.hsCode && (
                      <span className="rounded bg-background/50 px-1.5 py-0.5 text-xs font-mono">
                        {alert.hsCode}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${severityText}`}>{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(alert.createdAt)}
                  </p>
                </div>
                {alert.isAcknowledged ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Đã xác nhận
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={isAcknowledgePending}
                    className="shrink-0"
                  >
                    Xác nhận
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
