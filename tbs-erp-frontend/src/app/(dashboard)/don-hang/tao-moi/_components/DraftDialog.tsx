'use client';

export interface DraftDialogProps {
  onLoad: () => void;
  onDiscard: () => void;
}

export function DraftDialog({ onLoad, onDiscard }: DraftDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg border shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">Phát hiện nháp đơn hàng</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Bạn có một đơn hàng đã lưu nháp. Bạn có muốn tiếp tục nhập đơn này không?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onLoad}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tiếp tục nhập
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex-1 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Bắt đầu mới
          </button>
        </div>
      </div>
    </div>
  );
}
