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
      toast.success('Da sao chep tat ca ma backup');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Khong the sao chep');
    }
  };

  const handleDownload = () => {
    const content = [
      'TBS ERP - Ma backup xac thuc 2 yeu to',
      '========================================',
      `Ngay tao: ${new Date().toLocaleDateString('vi-VN')}`,
      '',
      'Moi ma chi su dung duoc mot lan.',
      'Luu tru o noi an toan.',
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
    toast.success('Da tai xuong file ma backup');
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
        Luu ma backup o noi an toan. Moi ma chi dung duoc mot lan.
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyAll}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Sao chep tat ca
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Tai xuong
        </Button>
      </div>
    </div>
  );
}
