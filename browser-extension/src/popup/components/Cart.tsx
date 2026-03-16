import { useState } from 'react';
import { useCart } from '../hooks/useCart';
import { CartItemRow } from './CartItem';
import { OrderForm } from './OrderForm';

interface CartProps {
  user: { id: string; email: string; fullName: string; role: string } | null;
  onLogout: () => void;
}

export function Cart({ user, onLogout }: CartProps) {
  const { items, isLoading, removeItem, updateItem, clearCart, refresh } = useCart();
  const [showOrderForm, setShowOrderForm] = useState(false);

  if (isLoading) {
    return (
      <div className="popup-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (showOrderForm) {
    return (
      <OrderForm
        cartItems={items}
        onSuccess={async () => {
          await clearCart();
          setShowOrderForm(false);
        }}
        onBack={() => setShowOrderForm(false)}
      />
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div>
          <h1>TBS ERP</h1>
          {user && <div className="user-info">{user.fullName}</div>}
        </div>
        <button onClick={onLogout} className="btn btn-secondary btn-sm">
          Đăng xuất
        </button>
      </div>

      {/* Cart items */}
      {items.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>Giỏ hàng trống</p>
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>
            Vào trang sản phẩm trên Taobao/1688 và bấm nút "Thêm vào ERP"
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ fontWeight: 600 }}>
              Giỏ hàng ({items.length})
            </span>
            <button onClick={clearCart} className="btn btn-danger btn-sm">
              Xóa tất cả
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onRemove={removeItem}
                onUpdateQuantity={(id, qty) => updateItem(id, { quantity: qty })}
              />
            ))}
          </div>

          {/* Summary */}
          <div className="divider" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Tổng cộng:</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
              ¥{items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0).toFixed(2)}
            </span>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => setShowOrderForm(true)}
          >
            Tạo đơn hàng ({items.length} SP)
          </button>
        </>
      )}
    </div>
  );
}
