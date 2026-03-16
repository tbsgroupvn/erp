'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import {
  FileText,
  Upload,
  Download,
  Eye,
  FolderOpen,
  Loader2,
  File,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/utils/constants';
import { DocumentCategory } from '@/lib/types/enums';
import { formatDateTime } from '@/lib/utils/format';

interface OrderDocumentHubProps {
  orderId: string;
  documents?: any[];
}

const CATEGORY_ICONS: Record<string, any> = {
  CONTRACT: FileText,
  INVOICE: FileText,
  CUSTOMS: FolderOpen,
  POD: FileText,
  PHOTO: ImageIcon,
  OTHER: File,
};

const CATEGORY_COLORS: Record<string, string> = {
  CONTRACT: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  INVOICE: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  CUSTOMS: 'bg-amber-50 border-amber-200 text-amber-700',
  POD: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  PHOTO: 'bg-pink-50 border-pink-200 text-pink-700',
  OTHER: 'bg-slate-50 border-slate-200 text-slate-700',
};

export function OrderDocumentHub({ orderId, documents = [] }: OrderDocumentHubProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group documents by category
  const grouped: Record<string, any[]> = {};
  for (const cat of Object.values(DocumentCategory)) {
    grouped[cat] = [];
  }
  for (const doc of documents) {
    const cat = doc.category || 'OTHER';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(doc);
  }

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'ORDER');
        formData.append('entityId', orderId);
        formData.append('category', selectedCategory);
        formData.append('name', file.name);

        await apiClient.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success(`Đã tải lên ${files.length} tài liệu`);
      // Trigger refetch by reloading
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi tải tài liệu');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = (doc: any) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    }
  };

  const handlePreview = (doc: any) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Tải tài liệu
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <label htmlFor="doc-category-select" className="text-sm font-medium">Danh mục</label>
            <select
              id="doc-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Đang tải...' : 'Chọn file'}
            </button>
          </div>
        </div>
      </div>

      {/* Documents grouped by category */}
      {Object.entries(grouped).map(([category, docs]) => {
        if (docs.length === 0) return null;
        const IconComponent = CATEGORY_ICONS[category] || File;
        const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER;

        return (
          <div key={category} className="rounded-lg border bg-card p-6">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <IconComponent className="h-4 w-4" />
              {DOCUMENT_CATEGORY_LABELS[category as DocumentCategory] || category}
              <span className="text-xs font-normal text-muted-foreground">({docs.length})</span>
            </h3>
            <div className="space-y-2">
              {docs.map((doc: any) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${colorClass}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <IconComponent className="h-5 w-5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.name || doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.fileSize ? formatFileSize(doc.fileSize) : ''}
                        {doc.uploadedByUser?.fullName && ` • ${doc.uploadedByUser.fullName}`}
                        {doc.createdAt && ` • ${formatDateTime(doc.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => handlePreview(doc)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-background/50"
                      title="Xem"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-background/50"
                      title="Tải xuống"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Chưa có tài liệu</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sử dụng nút &quot;Chọn file&quot; ở trên để tải lên tài liệu cho đơn hàng này.
          </p>
        </div>
      )}
    </div>
  );
}
