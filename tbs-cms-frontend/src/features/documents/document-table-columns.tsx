'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Document } from '@/lib/types/document.types';
import type { DocumentCategory } from '@/lib/types/enums';
import { StatusBadge } from '@/components/shared/status-badge';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import { documentsApi } from '@/lib/api/documents.api';
import { MoreHorizontal, Download, Trash2, FileText, FileImage, File } from 'lucide-react';
import { toast } from 'sonner';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const documentColumns: ColumnDef<Document>[] = [
  {
    accessorKey: 'name',
    header: 'Tên tài liệu',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {getFileIcon(row.original.mimeType)}
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Danh mục',
    cell: ({ row }) => (
      <StatusBadge
        label={DOCUMENT_CATEGORY_LABELS[row.original.category as DocumentCategory] || row.original.category}
        colorClass="bg-blue-50 text-blue-700"
      />
    ),
  },
  {
    accessorKey: 'entityType',
    header: 'Loại đối tượng',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.entityType} / {row.original.entityId}
      </span>
    ),
  },
  {
    accessorKey: 'fileSize',
    header: 'Kích thước',
    cell: ({ row }) => <span>{formatFileSize(row.original.fileSize)}</span>,
  },
  {
    accessorKey: 'version',
    header: 'Phiên bản',
    cell: ({ row }) => <span>v{row.original.version}</span>,
  },
  {
    accessorKey: 'uploadedBy',
    header: 'Người tải',
    cell: ({ row }) => (
      <span>{row.original.uploadedByUser?.fullName || row.original.uploadedBy}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="relative group">
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <div className="absolute right-0 top-full z-10 hidden w-48 rounded-md border bg-popover p-1 shadow-md group-hover:block">
          <a
            href={documentsApi.downloadUrl(row.original.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Tải xuống
          </a>
          <button
            onClick={() => toast.info('Tính năng đang phát triển')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
          >
            <Trash2 className="h-4 w-4" /> Xóa
          </button>
        </div>
      </div>
    ),
  },
];
