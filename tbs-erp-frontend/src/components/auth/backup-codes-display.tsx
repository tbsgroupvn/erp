'use client';

import { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BackupCodesDisplayProps {
  codes: string[];
}

export function BackupCodesDisplay({ codes }: BackupCodesDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      toast.success('Đã sao chép tất cả mã backup');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleDownload = () => {
    const content = [
      'TBS ERP - Mã backup xác thực 2 yếu tố',
      '========================================',
      `Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}`,
      '',
      'Mỗi mã chỉ sử dụng được một lần.',
      'Lưu trữ ở nơi an toàn.',
      '',
      ...codes.map((code, i) => `${(i + 1).toString().padStart(2, '0')}. ${code}`),
      '',
      '========================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tbs-erp-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file mã backup');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code, index) => (
            <div
              key={index}
              className="rounded-md bg-background px-3 py-2 text-center font-mono text-sm tracking-wider"
            >
              {code}
            </div>
          ))}
        </div>
      </div>

      <div
        role="alert"
        className="rounded-md border border-yellow-500/50 bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200"
      >
        Lưu mã backup ở nơi an toàn. Mỗi mã chỉ dùng được một lần.
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyAll}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Sao chép tất cả
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Tải xuống
        </Button>
      </div>
    </div>
  );
}
