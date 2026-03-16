'use client';

import { X } from 'lucide-react';
import type { OrderTemplate } from '@/lib/types';

export interface TemplateSelectorDialogProps {
  templates: OrderTemplate[];
  onApply: (template: OrderTemplate) => void;
  onClose: () => void;
}

export function TemplateSelectorDialog({
  templates,
  onApply,
  onClose,
}: TemplateSelectorDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg border shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Chọn Template</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-md border p-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{template.name}</h4>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {template.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {template.subOrders.length} đơn con &bull;{' '}
                    {template.subOrders.reduce(
                      (sum, so) => sum + so.items.length,
                      0,
                    )}{' '}
                    sản phẩm
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApply(template)}
                  className="ml-4 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
