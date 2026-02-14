'use client';

import { useState, useRef } from 'react';
import { Upload, Search, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { documentColumns } from '@/features/documents/document-table-columns';
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/lib/hooks/use-documents';
import { DocumentCategory } from '@/lib/types/enums';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/utils/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DocumentQueryParams } from '@/lib/types/document.types';

export default function TaiLieuPage() {
  const [filters, setFilters] = useState<DocumentQueryParams>({});
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const { data, isLoading } = useDocuments({ ...filters, page, limit: 20 });

  const [entityType, setEntityType] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  // Upload form
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState({
    name: '',
    category: '' as string,
    entityType: '',
    entityId: '',
  });
  const uploadDocument = useUploadDocument();

  const applyFilters = (overrides: Partial<{ entityType: string; category: string; search: string }> = {}) => {
    const newFilters: DocumentQueryParams = {
      entityType: (overrides.entityType !== undefined ? overrides.entityType : entityType) || undefined,
      category: ((overrides.category !== undefined ? overrides.category : category) || undefined) as DocumentCategory | undefined,
      search: (overrides.search !== undefined ? overrides.search : search) || undefined,
    };
    setFilters(newFilters);
    setPage(1);
  };

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (uploadData.name) formData.append('name', uploadData.name);
    if (uploadData.category) formData.append('category', uploadData.category);
    if (uploadData.entityType) formData.append('entityType', uploadData.entityType);
    if (uploadData.entityId) formData.append('entityId', uploadData.entityId);

    uploadDocument.mutate(formData, {
      onSuccess: () => {
        setShowUpload(false);
        setUploadData({ name: '', category: '', entityType: '', entityId: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  return (
    <div>
      <PageHeader title="Tài liệu" description="Quản lý tài liệu và tệp đính kèm">
        <Button onClick={() => setShowUpload((prev) => !prev)}>
          {showUpload ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Tải lên
            </>
          )}
        </Button>
      </PageHeader>

      {/* Upload form */}
      {showUpload && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tải tài liệu lên</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="file">Chọn tệp *</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docName">Tên tài liệu</Label>
                <Input
                  id="docName"
                  placeholder="Mặc định dùng tên file"
                  value={uploadData.name}
                  onChange={(e) =>
                    setUploadData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docCategory">Danh mục</Label>
                <select
                  id="docCategory"
                  value={uploadData.category}
                  onChange={(e) =>
                    setUploadData((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Chọn danh mục</option>
                  {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docEntityType">Loại đối tượng</Label>
                <select
                  id="docEntityType"
                  value={uploadData.entityType}
                  onChange={(e) =>
                    setUploadData((prev) => ({ ...prev, entityType: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Chọn loại</option>
                  <option value="ORDER">Đơn hàng</option>
                  <option value="CUSTOMER">Khách hàng</option>
                  <option value="VENDOR">Nhà cung cấp</option>
                  <option value="CONTAINER">Container</option>
                  <option value="PACKAGE">Kiện hàng</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docEntityId">Mã đối tượng</Label>
                <Input
                  id="docEntityId"
                  placeholder="Không bắt buộc"
                  value={uploadData.entityId}
                  onChange={(e) =>
                    setUploadData((prev) => ({ ...prev, entityId: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={uploadDocument.isPending || !fileInputRef.current?.files?.length}
              >
                {uploadDocument.isPending ? 'Đang tải...' : 'Tải lên'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUpload(false);
                  setUploadData({ name: '', category: '', entityType: '', entityId: '' });
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên tài liệu..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applyFilters({ search: e.target.value });
              }}
              className="pl-9"
            />
          </div>

          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              applyFilters({ entityType: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Loại đối tượng</option>
            <option value="ORDER">Đơn hàng</option>
            <option value="CUSTOMER">Khách hàng</option>
            <option value="VENDOR">Nhà cung cấp</option>
            <option value="CONTAINER">Container</option>
            <option value="PACKAGE">Kiện hàng</option>
          </select>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              applyFilters({ category: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Danh mục</option>
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <DataTable
          columns={documentColumns}
          data={data?.data ?? []}
          pageCount={data?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
