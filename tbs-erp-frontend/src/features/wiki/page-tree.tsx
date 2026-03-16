'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  Trash2,
  Move,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePageTree, useDeletePage, useMovePage } from '@/lib/hooks/use-wiki';
import type { WikiPageNode } from '@/lib/types/wiki.types';

interface PageTreeProps {
  spaceId: string;
  spaceSlug: string;
  onCreatePage?: (parentId?: string) => void;
}

// ---------------------------------------------------------------------------
// PageTreeNode — recursive
// ---------------------------------------------------------------------------
interface PageTreeNodeProps {
  node: WikiPageNode;
  activePageId: string | null;
  spaceId: string;
  spaceSlug: string;
  siblingCount: number;
  siblingIndex: number;
  onCreatePage?: (parentId?: string) => void;
  onDeleteRequest: (id: string, spaceId: string, title: string) => void;
  onMoveUp: (node: WikiPageNode) => void;
  onMoveDown: (node: WikiPageNode) => void;
}

function PageTreeNode({
  node,
  activePageId,
  spaceId,
  spaceSlug,
  siblingCount,
  siblingIndex,
  onCreatePage,
  onDeleteRequest,
  onMoveUp,
  onMoveDown,
}: PageTreeNodeProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === activePageId;

  const handleNavigate = () => {
    router.push(`/wiki/${spaceSlug}?page=${node.id}`);
  };

  return (
    <li className="select-none">
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100',
        )}
      >
        {/* Expand toggle */}
        <button
          className="w-4 h-4 flex items-center justify-center shrink-0 text-gray-400 hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          tabIndex={-1}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : (
            <span className="w-3 h-3" />
          )}
        </button>

        {/* Page icon + title */}
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={handleNavigate}
        >
          <FileText className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          <span className="text-sm truncate">
            {node.title}
            {!node.isPublished && (
              <span className="ml-1 text-xs text-amber-500 font-normal">(Draft)</span>
            )}
          </span>
        </button>

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200"
            onClick={(e) => { e.stopPropagation(); onCreatePage?.(node.id); }}
            title="Thêm trang con"
          >
            <Plus className="w-3 h-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onCreatePage?.(node.id)}>
                <Plus className="w-3.5 h-3.5 mr-2" />
                Thêm trang con
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onMoveUp(node)}
                disabled={siblingIndex === 0}
              >
                <ArrowUp className="w-3.5 h-3.5 mr-2" />
                Lên trên
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveDown(node)}
                disabled={siblingIndex === siblingCount - 1}
              >
                <ArrowDown className="w-3.5 h-3.5 mr-2" />
                Xuống dưới
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteRequest(node.id, spaceId, node.title)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Xóa trang
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100">
          {node.children.map((child, idx) => (
            <PageTreeNode
              key={child.id}
              node={child}
              activePageId={activePageId}
              spaceId={spaceId}
              spaceSlug={spaceSlug}
              siblingCount={node.children.length}
              siblingIndex={idx}
              onCreatePage={onCreatePage}
              onDeleteRequest={onDeleteRequest}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// PageTree (main export)
// ---------------------------------------------------------------------------
export function PageTree({ spaceId, spaceSlug, onCreatePage }: PageTreeProps) {
  const searchParams = useSearchParams();
  const activePageId = searchParams.get('page');

  const { data: tree = [], isLoading } = usePageTree(spaceId);
  const deletePage = useDeletePage();
  const movePage = useMovePage();

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; spaceId: string; title: string } | null>(null);

  const handleMoveUp = (node: WikiPageNode) => {
    if (node.position <= 0) return;
    movePage.mutate({ id: node.id, dto: { parentId: node.parentId ?? undefined, position: node.position - 1 } });
  };

  const handleMoveDown = (node: WikiPageNode) => {
    movePage.mutate({ id: node.id, dto: { parentId: node.parentId ?? undefined, position: node.position + 1 } });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deletePage.mutate({ id: deleteTarget.id, spaceId: deleteTarget.spaceId });
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trang</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onCreatePage?.()}
        >
          <Plus className="w-3 h-3 mr-1" />
          Thêm
        </Button>
      </div>

      {tree.length === 0 ? (
        <div className="px-2 py-4 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Chưa có trang nào</p>
          <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => onCreatePage?.()}>
            Tạo trang đầu tiên
          </Button>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {tree.map((node, idx) => (
            <PageTreeNode
              key={node.id}
              node={node}
              activePageId={activePageId}
              spaceId={spaceId}
              spaceSlug={spaceSlug}
              siblingCount={tree.length}
              siblingIndex={idx}
              onCreatePage={onCreatePage}
              onDeleteRequest={(id, sid, title) => setDeleteTarget({ id, spaceId: sid, title })}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
        </ul>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa trang?</AlertDialogTitle>
            <AlertDialogDescription>
              Trang <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong> sẽ bị xóa. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
