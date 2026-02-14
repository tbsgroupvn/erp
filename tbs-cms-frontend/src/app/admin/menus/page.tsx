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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Menu Item Component
function SortableMenuItem({
  item,
  level = 0,
  onDelete,
}: {
  item: MenuItem;
  level?: number;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${level * 24}px`,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors ${
          isDragging ? 'shadow-lg ring-2 ring-primary' : ''
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-medium">{item.label}</p>
          <p className="text-sm text-muted-foreground">{item.url}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {item.children && item.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {item.children.map((child) => (
            <SortableMenuItem
              key={child.id}
              item={child}
              level={level + 1}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MenusPage() {
  const queryClient = useQueryClient();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [newMenu, setNewMenu] = useState<Omit<CreateMenuDto, 'location'> & { location: string }>({
    name: '',
    location: ''
  });
  const [newItem, setNewItem] = useState({
    label: '',
    url: '',
    target: '_self',
    order: 0,
  });
  const [urlError, setUrlError] = useState<string>('');

  // URL validation function
  const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    // Allow relative paths or absolute URLs
    const relativePathRegex = /^\/[a-zA-Z0-9-_\/]*$/;
    const absoluteUrlRegex = /^https?:\/\/.+/;
    return relativePathRegex.test(url) || absoluteUrlRegex.test(url);
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      setUrlError('');
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

  const reorderItemsMutation = useMutation({
    mutationFn: menusApi.reorderMenuItems,
    onSuccess: () => {
      toast.success('Đã cập nhật thứ tự menu');
      queryClient.invalidateQueries({ queryKey: ['menu', selectedMenuId] });
    },
    onError: () => {
      toast.error('Không thể cập nhật thứ tự menu');
    },
  });

  const handleCreateMenu = () => {
    if (!newMenu.location) return;
    createMenuMutation.mutate({
      name: newMenu.name,
      location: newMenu.location as 'HEADER' | 'FOOTER' | 'SIDEBAR' | 'MOBILE',
    });
  };

  const handleCreateItem = () => {
    createItemMutation.mutate(newItem);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !selectedMenu?.data.items) {
      return;
    }

    const items = selectedMenu.data.items;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);

    // Update order numbers and send to backend
    const reorderedItems = newItems.map((item, index) => ({
      id: item.id,
      order: index,
      parentId: item.parentId,
    }));

    reorderItemsMutation.mutate(reorderedItems);
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
                    onClick={() => {
                      if (confirm(`Bạn có chắc muốn xóa menu này? Tất cả mục menu sẽ bị xóa.`)) {
                        deleteMenuMutation.mutate(selectedMenuId);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xóa menu
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {selectedMenu?.data.items && selectedMenu.data.items.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={selectedMenu.data.items.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {selectedMenu.data.items.map((item: MenuItem) => (
                          <SortableMenuItem
                            key={item.id}
                            item={item}
                            onDelete={(id) => deleteItemMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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
                autoFocus
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
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-url">URL *</Label>
              <Input
                id="item-url"
                value={newItem.url}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewItem({ ...newItem, url: value });
                  if (value && !isValidUrl(value)) {
                    setUrlError('URL không hợp lệ. Dùng "/about" hoặc "https://example.com"');
                  } else {
                    setUrlError('');
                  }
                }}
                placeholder="/about, https://example.com, ..."
                className={urlError ? 'border-red-500' : ''}
              />
              {urlError && (
                <p className="text-sm text-red-600">{urlError}</p>
              )}
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
              disabled={!newItem.label || !newItem.url || !!urlError || createItemMutation.isPending}
            >
              Thêm mục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
