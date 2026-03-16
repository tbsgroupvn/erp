import type { CartItem as CartItemType } from '../../types';

interface CartItemProps {
  item: CartItemType;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="%23e5e7eb"><rect width="56" height="56"/><text x="28" y="32" text-anchor="middle" fill="%239ca3af" font-size="10">No img</text></svg>';

export function CartItemRow({ item, onRemove, onUpdateQuantity }: CartItemProps) {
  const sourceLabels: Record<string, string> = {
    taobao: 'Taobao',
    '1688': '1688',
    tmall: 'Tmall',
  };

  return (
    <div className="cart-item">
      <img
        src={item.imageUrl || PLACEHOLDER_IMG}
        alt=""
        className="cart-item-image"
        onError={(e) => {
          (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
        }}
      />
      <div className="cart-item-info">
        <div className="cart-item-title" title={item.title}>
          {item.title || '(Không có tên)'}
        </div>
        <div className="cart-item-meta">
          <span className="badge badge-blue" style={{ marginRight: 4 }}>
            {sourceLabels[item.source] || item.source}
          </span>
          {item.shopName && <span>{item.shopName}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span className="cart-item-price">
            {item.price != null ? `¥${item.price.toFixed(2)}` : '—'}
          </span>
          <span className="text-muted text-xs">×</span>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onUpdateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: 48,
              padding: '2px 6px',
              fontSize: 12,
              border: '1px solid #d1d5db',
              borderRadius: 4,
              textAlign: 'center',
            }}
          />
        </div>
      </div>
      <div className="cart-item-actions">
        <button
          onClick={() => onRemove(item.id)}
          className="btn btn-danger btn-sm"
          title="Xóa"
          style={{ padding: '4px 6px' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
