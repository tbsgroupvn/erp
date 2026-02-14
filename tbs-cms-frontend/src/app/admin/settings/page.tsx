'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, Setting } from '@/lib/api/cms';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeGroup, setActiveGroup] = useState('general');
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', activeGroup],
    queryFn: () => settingsApi.getByGroup(activeGroup),
  });

  useEffect(() => {
    if (settings?.data) {
      const initialData: Record<string, string> = {};
      settings.data.forEach((setting: Setting) => {
        initialData[setting.key] = setting.value;
      });
      setFormData(initialData);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: { key: string; value: string }[]) =>
      settingsApi.batchUpdate(data),
    onSuccess: () => {
      toast.success('Đã cập nhật cài đặt thành công');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => {
      toast.error('Không thể cập nhật cài đặt');
    },
  });

  const handleSubmit = () => {
    // Validate JSON fields before submitting
    const jsonSettings = settings?.data?.filter((s: Setting) => s.type === 'json') || [];
    for (const setting of jsonSettings) {
      const value = formData[setting.key];
      if (value) {
        try {
          JSON.parse(value);
        } catch (e) {
          toast.error(`Lỗi JSON trong "${setting.label}": Định dạng không hợp lệ`);
          return;
        }
      }
    }

    const updates = Object.entries(formData).map(([key, value]) => ({
      key,
      value,
    }));
    updateMutation.mutate(updates);
  };

  const renderInput = (setting: Setting) => {
    const value = formData[setting.key] || '';
    const onChange = (newValue: string) => {
      setFormData({
        ...formData,
        [setting.key]: newValue,
      });
    };

    switch (setting.type) {
      case 'number':
        return (
          <Input
            id={setting.key}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.hint}
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              id={setting.key}
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 cursor-pointer"
            />
            <Label htmlFor={setting.key} className="cursor-pointer">
              {setting.hint}
            </Label>
          </div>
        );
      case 'json':
        let isValidJson = true;
        let jsonError = '';
        if (value) {
          try {
            JSON.parse(value);
          } catch (e) {
            isValidJson = false;
            jsonError = 'JSON không hợp lệ';
          }
        }
        return (
          <div className="space-y-1">
            <Textarea
              id={setting.key}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={setting.hint}
              rows={6}
              className={`font-mono text-sm ${!isValidJson ? 'border-red-500' : ''}`}
            />
            {!isValidJson && (
              <p className="text-sm text-red-600">{jsonError}</p>
            )}
          </div>
        );
      default:
        return (
          <Input
            id={setting.key}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.hint}
          />
        );
    }
  };

  return (
    <div>
      <PageHeader title="Cài đặt" description="Cấu hình website và hệ thống">
        <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Lưu thay đổi
        </Button>
      </PageHeader>

      <Tabs value={activeGroup} onValueChange={setActiveGroup}>
        <TabsList>
          <TabsTrigger value="general">Chung</TabsTrigger>
          <TabsTrigger value="contact">Liên hệ</TabsTrigger>
          <TabsTrigger value="social">Mạng xã hội</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value={activeGroup} className="space-y-6">
          <Card className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : settings?.data.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Chưa có cài đặt nào trong nhóm này
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {settings?.data.map((setting: Setting) => (
                  <div key={setting.id} className="space-y-2">
                    {setting.type !== 'boolean' && (
                      <Label htmlFor={setting.key}>{setting.label}</Label>
                    )}
                    {renderInput(setting)}
                    {setting.hint && setting.type !== 'boolean' && (
                      <p className="text-sm text-muted-foreground">
                        {setting.hint}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
