'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ScanText,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ClipboardCopy,
  Plus,
  Trash2,
  Save,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';

interface PackingListItem {
  nameCn: string;
  nameVi: string;
  quantity: number;
  weightKg: number;
  tracking: string;
}

interface PackingListResult {
  items: PackingListItem[];
  totalWeightKg: number;
  totalItems: number;
  shipper: string;
  trackingNumbers: string[];
}

interface PackingListOCRProps {
  onApply?: (items: PackingListItem[], trackingNumbers: string[]) => void;
}

const EMPTY_ITEM: PackingListItem = { nameCn: '', nameVi: '', quantity: 1, weightKg: 0, tracking: '' };

export function PackingListOCR({ onApply }: PackingListOCRProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PackingListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable items state (mirrors result.items but mutable)
  const [editableItems, setEditableItems] = useState<PackingListItem[]>([]);
  const [hasEdited, setHasEdited] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File quá lớn (tối đa 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      const base64 = dataUrl.split(',')[1];
      if (!base64) return;

      setIsProcessing(true);
      setError(null);
      setResult(null);
      setEditableItems([]);
      setHasEdited(false);

      try {
        const response = await apiClient.post<{ data: PackingListResult }>(
          '/ai/extract-document',
          { imageBase64: base64, mimeType: file.type, type: 'PACKING_LIST' },
        );

        const data = response.data.data;
        setResult(data);
        setEditableItems(data.items.map((item) => ({ ...item })));

        if (data.items.length === 0) {
          setError('Không nhận diện được sản phẩm nào từ ảnh. Vui lòng thử lại với ảnh rõ hơn.');
        } else {
          toast.success(`Nhận diện ${data.items.length} sản phẩm`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi xử lý OCR. Vui lòng thử lại.';
        setError(msg);
        toast.error('OCR thất bại', { description: msg });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: isProcessing,
  });

  const handleClose = () => {
    setIsOpen(false);
    setPreview(null);
    setResult(null);
    setError(null);
    setEditableItems([]);
    setHasEdited(false);
  };

  // --- Editable item helpers ---

  const updateItem = (index: number, field: keyof PackingListItem, value: string | number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setHasEdited(true);
  };

  const addItem = () => {
    setEditableItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    setHasEdited(true);
  };

  const removeItem = (index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
    setHasEdited(true);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setEditableItems((prev) => {
      const next = [...prev];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return next;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
    setHasEdited(true);
  };

  const handleSaveEdits = () => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            items: editableItems,
            totalItems: editableItems.reduce((s, i) => s + i.quantity, 0),
            totalWeightKg: editableItems.reduce((s, i) => s + i.weightKg, 0),
            trackingNumbers: editableItems.map((i) => i.tracking).filter(Boolean),
          }
        : prev,
    );
    setHasEdited(false);
    toast.success('Đã lưu chỉnh sửa');
  };

  const handleApply = () => {
    if (editableItems.length === 0) return;
    const trackingNumbers = editableItems.map((i) => i.tracking).filter(Boolean);
    onApply?.(editableItems, trackingNumbers);
    toast.success(`Đã áp dụng ${editableItems.length} sản phẩm`);
    handleClose();
  };

  const handleCopyTrackings = () => {
    const nums = editableItems.map((i) => i.tracking).filter(Boolean);
    if (!nums.length) return;
    navigator.clipboard.writeText(nums.join('\n'));
    toast.success('Đã copy mã vận đơn');
  };

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
        <ScanText className="h-4 w-4" />
        OCR Packing List
      </Button>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ScanText className="h-5 w-5" />
            OCR Packing List
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload ảnh Packing List tiếng Trung — AI tự động bóc tách: tracking, tên hàng, số lượng,
          cân nặng và dịch sang tiếng Việt.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Drop zone */}
        {!preview && (
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {isDragActive ? 'Thả file vào đây...' : 'Kéo thả hoặc click để chọn ảnh'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hỗ trợ: JPG, PNG, WEBP (tối đa 10MB)
            </p>
          </div>
        )}

        {/* Image preview + processing */}
        {preview && (
          <div className="space-y-3">
            <div className="relative">
              <img
                src={preview}
                alt="Packing List preview"
                className="w-full max-h-64 object-contain rounded-lg border"
              />
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">AI đang phân tích...</p>
                    <p className="text-xs text-muted-foreground">Có thể mất 5-15 giây</p>
                  </div>
                </div>
              )}
            </div>
            {!isProcessing && !result && !error && (
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                Chọn ảnh khác
              </Button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => { setPreview(null); setError(null); setResult(null); setEditableItems([]); }}
              >
                Thử lại
              </Button>
            </div>
          </div>
        )}

        {/* Editable result table */}
        {result && editableItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">
                Đã nhận diện {editableItems.length} sản phẩm
              </span>
              {result.shipper && (
                <span className="text-muted-foreground">
                  | NVC: <span className="font-medium">{result.shipper}</span>
                </span>
              )}
            </div>

            {/* Table with inline editing */}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-2 text-center font-medium w-8">#</th>
                    <th className="px-2 py-2 text-left font-medium">Tên (TQ)</th>
                    <th className="px-2 py-2 text-left font-medium">Tên (VN)</th>
                    <th className="px-2 py-2 text-center font-medium w-16">SL</th>
                    <th className="px-2 py-2 text-right font-medium w-20">CN (kg)</th>
                    <th className="px-2 py-2 text-left font-medium">Tracking</th>
                    <th className="px-2 py-2 text-center font-medium w-20">Thứ tự</th>
                    <th className="px-2 py-2 text-center font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {editableItems.map((item, i) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-2 py-1.5 text-center text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={item.nameCn}
                          onChange={(e) => updateItem(i, 'nameCn', e.target.value)}
                          className="h-7 text-xs px-1.5"
                          placeholder="Tên TQ..."
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={item.nameVi}
                          onChange={(e) => updateItem(i, 'nameVi', e.target.value)}
                          className="h-7 text-xs px-1.5 font-medium"
                          placeholder="Tên VN..."
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                          className="h-7 text-xs px-1.5 text-center"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.weightKg}
                          onChange={(e) => updateItem(i, 'weightKg', Number(e.target.value))}
                          className="h-7 text-xs px-1.5 text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={item.tracking}
                          onChange={(e) => updateItem(i, 'tracking', e.target.value)}
                          className="h-7 text-xs px-1.5 font-mono"
                          placeholder="Tracking..."
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveItem(i, 'up')}
                            disabled={i === 0}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveItem(i, 'down')}
                            disabled={i === editableItems.length - 1}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row button */}
            <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng
            </Button>

            {/* Tracking numbers */}
            {editableItems.some((i) => i.tracking) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {editableItems.filter((i) => i.tracking).length} mã vận đơn
                </span>
                <Button variant="ghost" size="sm" onClick={handleCopyTrackings} className="gap-1.5">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {hasEdited && (
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleSaveEdits}>
                  <Save className="h-3.5 w-3.5" />
                  Lưu chỉnh sửa
                </Button>
              )}
              {onApply && (
                <Button onClick={handleApply} size="sm">
                  Áp dụng {editableItems.length} sản phẩm
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPreview(null); setResult(null); setError(null); setEditableItems([]); }}
              >
                Chọn ảnh khác
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
