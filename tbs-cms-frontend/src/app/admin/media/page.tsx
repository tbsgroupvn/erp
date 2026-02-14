'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi, Media } from '@/lib/api/cms';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDropzone } from 'react-dropzone';
import { Upload, Grid, List, Trash2, Search, FolderOpen, Image as ImageIcon, FileText, Film } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [type, setType] = useState('all');
  const [folder, setFolder] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['media', { type, folder, search }],
    queryFn: () => mediaApi.list({
      type: (type && type !== 'all') ? (type as 'IMAGE' | 'VIDEO' | 'DOCUMENT') : undefined,
      folder: folder || undefined,
      search: search || undefined
    }),
  });

  const uploadMutation = useMutation<unknown, Error, File[]>({
    mutationFn: async (files: File[]) => {
      if (files.length === 1) {
        return await mediaApi.upload(files[0], folder || undefined);
      }
      return await mediaApi.uploadMultiple(files, folder || undefined);
    },
    onSuccess: () => {
      toast.success('Đã upload thành công');
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Upload thất bại';
      if (errorMessage.includes('size')) {
        toast.error('Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn.');
      } else if (errorMessage.includes('type') || errorMessage.includes('format')) {
        toast.error('Định dạng tệp không được hỗ trợ.');
      } else if (errorMessage.includes('network')) {
        toast.error('Lỗi kết nối. Vui lòng thử lại.');
      } else {
        toast.error(`Upload thất bại: ${errorMessage}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: mediaApi.bulkDelete,
    onSuccess: () => {
      toast.success('Đã xóa media thành công');
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    uploadMutation.mutate(acceptedFiles);
  }, [folder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'video/*': ['.mp4', '.webm', '.ogg'],
      'application/pdf': ['.pdf'],
    },
  });

  const handleDelete = () => {
    if (selected.length > 0) {
      if (confirm(`Bạn có chắc muốn xóa ${selected.length} tệp đã chọn? Hành động này không thể hoàn tác.`)) {
        deleteMutation.mutate(selected);
      }
    }
  };

  const getIcon = (media: Media) => {
    switch (media.type) {
      case 'IMAGE':
        return <ImageIcon className="h-12 w-12 text-muted-foreground" />;
      case 'VIDEO':
        return <Film className="h-12 w-12 text-muted-foreground" />;
      default:
        return <FileText className="h-12 w-12 text-muted-foreground" />;
    }
  };

  return (
    <div>
      <PageHeader title="Media Library" description="Quản lý files và ảnh">
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa ({selected.length})
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-lg">Thả files vào đây...</p>
          ) : (
            <div>
              <p className="text-lg mb-2">Kéo thả files vào đây hoặc click để chọn</p>
              <p className="text-sm text-muted-foreground">
                Hỗ trợ: Images, Videos, PDFs (Max 50MB)
              </p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Loại file" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="IMAGE">Hình ảnh</SelectItem>
              <SelectItem value="VIDEO">Video</SelectItem>
              <SelectItem value="DOCUMENT">Tài liệu</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button
              variant={view === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setView('grid')}
              aria-label="Xem dạng lưới"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setView('list')}
              aria-label="Xem dạng danh sách"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Media Grid/List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-slate-600">Đang tải media...</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data?.data.data.map((media: Media) => (
              <div
                key={media.id}
                onClick={() => {
                  if (selected.includes(media.id)) {
                    setSelected(selected.filter(id => id !== media.id));
                  } else {
                    setSelected([...selected, media.id]);
                  }
                }}
                className={`
                  relative group cursor-pointer rounded-lg border-2 overflow-hidden
                  transition-all hover:border-primary
                  ${selected.includes(media.id) ? 'border-primary ring-2 ring-primary' : 'border-border'}
                `}
              >
                <div className="aspect-square bg-muted relative flex items-center justify-center">
                  {media.type === 'IMAGE' ? (
                    <Image
                      src={media.thumbnailUrl || media.url}
                      alt={media.alt || media.originalName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground">
                      {getIcon(media)}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-background">
                  <p className="text-xs truncate" title={media.originalName}>
                    {media.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(media.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {data?.data.data.map((media: Media) => (
              <div
                key={media.id}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  if (selected.includes(media.id)) {
                    setSelected(selected.filter(id => id !== media.id));
                  } else {
                    setSelected([...selected, media.id]);
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(media.id)}
                  onChange={() => {}}
                  className="cursor-pointer"
                />
                <div className="w-16 h-16 relative bg-muted rounded flex items-center justify-center">
                  {media.type === 'IMAGE' ? (
                    <Image
                      src={media.thumbnailUrl || media.url}
                      alt={media.alt || media.originalName}
                      fill
                      className="object-cover rounded"
                    />
                  ) : (
                    <div className="text-muted-foreground">
                      {getIcon(media)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{media.originalName}</p>
                  <p className="text-sm text-muted-foreground">
                    {media.type} • {formatBytes(media.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
