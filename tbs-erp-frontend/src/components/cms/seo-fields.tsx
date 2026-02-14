'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface SEOFieldsProps {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onMetaKeywordsChange: (value: string[]) => void;
}

export function SEOFields({
  metaTitle,
  metaDescription,
  metaKeywords,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onMetaKeywordsChange,
}: SEOFieldsProps) {
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-heading font-semibold mb-4">SEO Settings</h3>
        <p className="text-sm text-muted-foreground">
          Tối ưu hóa trang cho công cụ tìm kiếm
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaTitle">Meta Title</Label>
        <Input
          id="metaTitle"
          value={metaTitle}
          onChange={(e) => onMetaTitleChange(e.target.value)}
          maxLength={60}
          placeholder="Tiêu đề SEO (khuyến nghị 50-60 ký tự)"
        />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Xuất hiện trên kết quả tìm kiếm Google
          </span>
          <span
            className={
              metaTitle.length > 60
                ? 'text-destructive'
                : metaTitle.length > 50
                  ? 'text-orange-500'
                  : 'text-muted-foreground'
            }
          >
            {metaTitle.length}/60 ký tự
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaDescription">Meta Description</Label>
        <Textarea
          id="metaDescription"
          value={metaDescription}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="Mô tả ngắn gọn (khuyến nghị 150-160 ký tự)"
        />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Mô tả xuất hiện dưới tiêu đề trên Google
          </span>
          <span
            className={
              metaDescription.length > 160
                ? 'text-destructive'
                : metaDescription.length > 150
                  ? 'text-orange-500'
                  : 'text-muted-foreground'
            }
          >
            {metaDescription.length}/160 ký tự
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaKeywords">Meta Keywords</Label>
        <Input
          id="metaKeywords"
          value={metaKeywords.join(', ')}
          onChange={(e) =>
            onMetaKeywordsChange(
              e.target.value
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean),
            )
          }
          placeholder="keyword1, keyword2, keyword3"
        />
        <p className="text-xs text-muted-foreground">
          Phân cách bằng dấu phẩy. Khuyến nghị 5-10 từ khóa.
        </p>
      </div>
    </Card>
  );
}
