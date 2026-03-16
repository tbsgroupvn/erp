'use client';

import { useState, type MouseEvent } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FolderPlus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useFolders,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
} from '@/lib/hooks/use-drive';
import type { DriveFolder } from '@/lib/types/drive.types';

interface FolderTreeProps {
  folders: DriveFolder[];
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}

interface FolderNodeProps {
  folder: DriveFolder;
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
  level: number;
}

function FolderNode({ folder, selectedId, onSelect, level }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [subFolderName, setSubFolderName] = useState('');

  const { data: children = [] } = useFolders(folder.id);
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const createFolder = useCreateFolder();

  const hasChildren = (folder._count?.children ?? 0) > 0 || children.length > 0;
  const isSelected = selectedId === folder.id;

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleSelect = () => {
    onSelect(folder.id);
  };

  const handleRename = () => {
    renameFolder.mutate(
      { id: folder.id, dto: { name: newName } },
      { onSuccess: () => setRenameOpen(false) },
    );
  };

  const handleDelete = () => {
    deleteFolder.mutate(folder.id, {
      onSuccess: () => {
        if (selectedId === folder.id) onSelect(undefined);
      },
    });
  };

  const handleCreateSub = () => {
    if (!subFolderName.trim()) return;
    createFolder.mutate(
      { name: subFolderName.trim(), parentId: folder.id },
      {
        onSuccess: () => {
          setNewFolderOpen(false);
          setSubFolderName('');
          setExpanded(true);
        },
      },
    );
  };

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent text-accent-foreground font-medium',
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleSelect}
      >
        {/* Expand toggle */}
        <button
          className="h-4 w-4 shrink-0 text-muted-foreground"
          onClick={handleToggle}
        >
          {hasChildren || expanded ? (
            expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>

        {/* Folder icon */}
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-yellow-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
        )}

        <span className="flex-1 truncate">{folder.name}</span>

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setNewName(folder.name);
                setRenameOpen(true);
              }}
            >
              Đổi tên
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setNewFolderOpen(true);
              }}
            >
              Tạo thư mục con
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              Xóa thư mục
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên thư mục</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tên mới</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleRename} disabled={renameFolder.isPending}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create subfolder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo thư mục con trong &ldquo;{folder.name}&rdquo;</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tên thư mục</Label>
            <Input
              value={subFolderName}
              onChange={(e) => setSubFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSub()}
              placeholder="Nhập tên thư mục..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateSub} disabled={createFolder.isPending || !subFolderName.trim()}>
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FolderTree({ folders, selectedId, onSelect }: FolderTreeProps) {
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const createFolder = useCreateFolder();

  const handleCreateRoot = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(
      { name: newFolderName.trim() },
      {
        onSuccess: () => {
          setNewFolderOpen(false);
          setNewFolderName('');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Root item */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
          selectedId === undefined && 'bg-accent text-accent-foreground font-medium',
        )}
        onClick={() => onSelect(undefined)}
      >
        <Folder className="h-4 w-4 text-blue-500" />
        <span>Tất cả file</span>
      </div>

      <div className="my-1 border-t" />

      {/* Folder list */}
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          selectedId={selectedId}
          onSelect={onSelect}
          level={0}
        />
      ))}

      {folders.length === 0 && (
        <p className="px-2 py-2 text-xs text-muted-foreground">Chưa có thư mục nào</p>
      )}

      {/* New root folder */}
      <button
        className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => setNewFolderOpen(true)}
      >
        <FolderPlus className="h-3.5 w-3.5" />
        Thư mục mới
      </button>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo thư mục mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tên thư mục</Label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoot()}
              placeholder="Nhập tên thư mục..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateRoot} disabled={createFolder.isPending || !newFolderName.trim()}>
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
