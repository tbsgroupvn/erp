'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { emailApi } from '@/lib/api/email.api';

type EmailTemplate = 'custom' | 'quotation' | 'invoice';

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nếu truyền quotationId, mặc định chọn template Báo giá */
  quotationId?: string;
  quotationCode?: string;
  /** Nếu truyền invoiceId, mặc định chọn template Hóa đơn */
  invoiceId?: string;
  invoiceCode?: string;
  /** Email khách hàng để auto-fill */
  defaultTo?: string;
}

const TEMPLATE_LABELS: Record<EmailTemplate, string> = {
  custom: 'Tùy chỉnh',
  quotation: 'Báo giá',
  invoice: 'Hóa đơn',
};

export function EmailComposeDialog({
  open,
  onOpenChange,
  quotationId,
  quotationCode,
  invoiceId,
  invoiceCode,
  defaultTo = '',
}: EmailComposeDialogProps) {
  const [to, setTo] = React.useState(defaultTo);
  const [cc, setCc] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [template, setTemplate] = React.useState<EmailTemplate>(() => {
    if (quotationId) return 'quotation';
    if (invoiceId) return 'invoice';
    return 'custom';
  });

  // Đồng bộ defaultTo khi dialog mở
  React.useEffect(() => {
    if (open) {
      setTo(defaultTo);
    }
  }, [open, defaultTo]);

  // Auto-fill subject/body khi chọn template
  React.useEffect(() => {
    if (template === 'quotation' && quotationCode) {
      setSubject(`Báo giá ${quotationCode} từ TBS Logistics`);
      setBody(`Kính gửi Quý khách,\n\nVui lòng xem báo giá ${quotationCode} trong file đính kèm.\n\nTrân trọng,\nTBS Logistics`);
    } else if (template === 'invoice' && invoiceCode) {
      setSubject(`Hóa đơn ${invoiceCode} từ TBS Logistics`);
      setBody(`Kính gửi Quý khách,\n\nVui lòng thanh toán theo thông tin trong hóa đơn ${invoiceCode}.\n\nTrân trọng,\nTBS Logistics`);
    } else if (template === 'custom') {
      setSubject('');
      setBody('');
    }
  }, [template, quotationCode, invoiceCode]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const ccList = cc
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      if (template === 'quotation' && quotationId) {
        return emailApi.sendQuotation(quotationId, { to });
      }
      if (template === 'invoice' && invoiceId) {
        return emailApi.sendInvoice(invoiceId, { to });
      }
      return emailApi.send({
        to,
        subject,
        body,
        cc: ccList.length ? ccList : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Email đã được gửi thành công');
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error('Gửi email thất bại, vui lòng thử lại');
    },
  });

  const resetForm = () => {
    setTo(defaultTo);
    setCc('');
    setSubject('');
    setBody('');
    setTemplate(quotationId ? 'quotation' : invoiceId ? 'invoice' : 'custom');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const canSubmit =
    to.trim() &&
    (template !== 'custom' || (subject.trim() && body.trim())) &&
    !sendMutation.isPending;

  // Xác định danh sách template khả dụng
  const availableTemplates: EmailTemplate[] = ['custom'];
  if (quotationId) availableTemplates.unshift('quotation');
  if (invoiceId) availableTemplates.unshift('invoice');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Soạn email
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Template */}
          <div className="grid gap-1.5">
            <Label htmlFor="template">Template</Label>
            <Select
              value={template}
              onValueChange={(v) => setTemplate(v as EmailTemplate)}
            >
              <SelectTrigger id="template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TEMPLATE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div className="grid gap-1.5">
            <Label htmlFor="to">
              Người nhận <span className="text-destructive">*</span>
            </Label>
            <Input
              id="to"
              type="email"
              placeholder="email@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* CC */}
          <div className="grid gap-1.5">
            <Label htmlFor="cc">CC (phân cách bằng dấu phẩy)</Label>
            <Input
              id="cc"
              type="text"
              placeholder="email1@example.com, email2@example.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>

          {/* Subject (chỉ hiện khi custom) */}
          {template === 'custom' && (
            <div className="grid gap-1.5">
              <Label htmlFor="subject">
                Tiêu đề <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                placeholder="Nhập tiêu đề email"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>
          )}

          {/* Subject preview (khi dùng template) */}
          {template !== 'custom' && subject && (
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground">Tiêu đề (tự động)</Label>
              <p className="text-sm px-3 py-2 rounded-md bg-muted text-muted-foreground">
                {subject}
              </p>
            </div>
          )}

          {/* Body */}
          {template === 'custom' && (
            <div className="grid gap-1.5">
              <Label htmlFor="body">
                Nội dung <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="body"
                placeholder="Nhập nội dung email..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={50000}
                className="resize-none"
              />
            </div>
          )}

          {/* Body preview (khi dùng template) */}
          {template !== 'custom' && body && (
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground">Nội dung (tự động)</Label>
              <p className="text-sm px-3 py-2 rounded-md bg-muted text-muted-foreground whitespace-pre-line line-clamp-4">
                {body}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={sendMutation.isPending}>
            <X className="h-4 w-4 mr-1" />
            Hủy
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSubmit}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-1" />
            )}
            Gửi email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
