'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export type ExportFormat = 'csv' | 'html';

export interface ExportButtonProps {
  /** API path relative to /api/v1, e.g. "/reports/orders/export" */
  endpoint: string;
  /** Base filename without extension */
  filename: string;
  /** Extra query params merged with format */
  params?: Record<string, string | number | undefined>;
  /** Which formats to show (default: both) */
  formats?: ExportFormat[];
  /** Button label */
  label?: string;
  /** Button size */
  size?: 'sm' | 'default';
  /** Disable the button */
  disabled?: boolean;
}

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

export function ExportButton({
  endpoint,
  filename,
  params = {},
  formats = ['csv', 'html'],
  label = 'Xuat',
  size = 'sm',
  disabled = false,
}: ExportButtonProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setLoading(format);
    try {
      const { accessToken } = useAuthStore.getState();
      const url = buildUrl(endpoint, { ...params, format });

      if (format === 'html') {
        // Open in new tab — let user Print/Save as PDF
        // We need auth header, so fetch first then open blob URL
        const response = await fetch(url, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Loi ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        // Clean up after a few seconds
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      } else {
        // Download CSV
        const response = await fetch(url, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Loi ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5_000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Khong the xuat du lieu';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  if (formats.length === 1) {
    // Single format — plain button, no dropdown
    const fmt = formats[0];
    return (
      <Button
        variant="outline"
        size={size}
        disabled={disabled || isLoading}
        onClick={() => handleExport(fmt)}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled || isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.includes('csv') && (
          <DropdownMenuItem
            onClick={() => handleExport('csv')}
            disabled={loading === 'csv'}
          >
            {loading === 'csv' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Xuat Excel/CSV
          </DropdownMenuItem>
        )}
        {formats.includes('html') && (
          <DropdownMenuItem
            onClick={() => handleExport('html')}
            disabled={loading === 'html'}
          >
            {loading === 'html' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            In / Xuat PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
