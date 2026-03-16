'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menusApi, Menu, MenuItem, CreateMenuDto, CreateMenuItemDto } from '@/lib/api/cms';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function MenusPage() {
  const queryClient = useQueryClient();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', location: '' });
  const [newItem, setNewItem] = useState({
    label: '',
    url: '',
    target: '_self',
    order: 0,
  });

  const { data: menus } = useQuery({
    queryKey: ['menus'],
    queryFn: () => menusApi.listMenus(),
  });

  const { data: selectedMenu } = useQuery({
    queryKey: ['menu', selectedMenuId],
    queryFn: () => menusApi.getMenu(selectedMenuId!),
    enabled: !!selectedMenuId,
  });

  const createMenuMutation = useMutation({
    mutationFn: menusApi.createMenu,
    onSuccess: () => {
      toast.success('Đã tạo menu thành công');
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      setCreateMenuOpen(false);
      setNewMenu({ name: '', location: '' });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: CreateMenuItemDto) => menusApi.createMenuItem(selectedMenuId!, data),
    onSuccess: () => {
      toast.success('Đã thêm mục menu thành công');
      queryClient.invalidateQueries({ queryKey: ['menu', selectedMenuId] });
      setCreateItemOpen(false);
      setNewItem({ label: '', url: '', target: '_self', order: 0 });
    },
  });

  const deleteMenuMutation = useMutation({
    mutationFn: menusApi.deleteMenu,
    onSuccess: () => {
      toast.success('Đã xóa menu thành công');
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      setSelectedMenuId(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: menusApi.deleteMenuItem,
    onSuccess: () => {
      toast.success('Đã xóa mục menu thành công');
      queryClient.invalidateQueries({ queryKey: ['menu', selectedMenuId] });
    },
  });

  const handleCreateMenu = () => {
    createMenuMutation.mutate(newMenu as CreateMenuDto);
  };

  const handleCreateItem = () => {
    createItemMutation.mutate(newItem);
  };

  const renderMenuItem = (item: MenuItem, level = 0) => {
    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors`}
          style={{ marginLeft: `${level * 24}px` }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
          <div className="flex-1">
            <p className="font-medium">{item.label}</p>
            <p className="text-sm text-muted-foreground">{item.url}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteItemMutation.mutate(item.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        {item.children && item.children.length > 0 && (
          <div className="mt-2 space-y-2">
            {item.children.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Menus" description="Quản lý menu điều hướng">
        <Button onClick={() => setCreateMenuOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo menu mới
        </Button>
      </PageHeader>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Menu list sidebar */}
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold mb-4">Danh sách Menu</h3>
          {menus?.data.map((menu: Menu) => (
            <div key={menu.id} className="space-y-1">
              <Button
                variant={selectedMenuId === menu.id ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setSelectedMenuId(menu.id)}
              >
                <div className="flex-1 text-left">
                  <p>{menu.name}</p>
                  <p className="text-xs opacity-70">{menu.location}</p>
                </div>
              </Button>
            </div>
          ))}
          {menus?.data.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Chưa có menu nào
            </p>
          )}
        </Card>

        {/* Menu items editor */}
        <Card className="md:col-span-2 p-6">
          {selectedMenuId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedMenu?.data.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Location: {selectedMenu?.data.location}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setCreateItemOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm mục
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMenuMutation.mutate(selectedMenuId)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xóa menu
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {selectedMenu?.data.items && selectedMenu.data.items.length > 0 ? (
                  selectedMenu.data.items.map((item: MenuItem) =>
                    renderMenuItem(item)
                  )
                ) : (
                  <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">
                      Menu chưa có mục nào. Nhấn &quot;Thêm mục&quot; để bắt đầu.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">Chọn menu để chỉnh sửa</p>
            </div>
          )}
        </Card>
      </div>

      {/* Create Menu Dialog */}
      <Dialog open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo menu mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-name">Tên menu *</Label>
              <Input
                id="menu-name"
                value={newMenu.name}
                onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                placeholder="Main Menu, Footer Menu, ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-location">Vị trí *</Label>
              <Select
                value={newMenu.location}
                onValueChange={(value) => setNewMenu({ ...newMenu, location: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vị trí" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEADER">Header</SelectItem>
                  <SelectItem value="FOOTER">Footer</SelectItem>
                  <SelectItem value="SIDEBAR">Sidebar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMenuOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleCreateMenu}
              disabled={!newMenu.name || !newMenu.location || createMenuMutation.isPending}
            >
              Tạo menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Menu Item Dialog */}
      <Dialog open={createItemOpen} onOpenChange={setCreateItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm mục menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-label">Nhãn *</Label>
              <Input
                id="item-label"
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                placeholder="Trang chủ, Giới thiệu, ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-url">URL *</Label>
              <Input
                id="item-url"
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                placeholder="/about, https://example.com, ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-target">Target</Label>
              <Select
                value={newItem.target}
                onValueChange={(value) => setNewItem({ ...newItem, target: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_self">Cùng tab (_self)</SelectItem>
                  <SelectItem value="_blank">Tab mới (_blank)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-order">Thứ tự</Label>
              <Input
                id="item-order"
                type="number"
                value={newItem.order}
                onChange={(e) => setNewItem({ ...newItem, order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateItemOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={!newItem.label || !newItem.url || createItemMutation.isPending}
            >
              Thêm mục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
