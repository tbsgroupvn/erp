import { useState, type FormEvent } from 'react';
import type { CartItem } from '../../types';
import type { ERPCustomer, Branch, ServiceType } from '../../types';
import type { CreateMasterOrderDto } from '../../types/api';
import type { MessageResponse } from '../../background/messages';
import { CustomerSearch } from './CustomerSearch';

interface OrderFormProps {
  cartItems: CartItem[];
  onSuccess: () => void;
  onBack: () => void;
}

const BRANCH_OPTIONS: { value: Branch; label: string }[] = [
  { value: 'HN', label: 'Hà Nội' },
  { value: 'HCM', label: 'TP. Hồ Chí Minh' },
];

const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'MHH', label: 'Mua hàng hộ' },
  { value: 'VCT', label: 'Vận chuyển thuần' },
  { value: 'UTXNK', label: 'Ủy thác XNK' },
  { value: 'LCLCN', label: 'LCL chính ngạch' },
];

export function OrderForm({ cartItems, onSuccess, onBack }: OrderFormProps) {
  const [customer, setCustomer] = useState<ERPCustomer | null>(null);
  const [branch, setBranch] = useState<Branch>('HN');
  const [serviceType, setServiceType] = useState<ServiceType>('MHH');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customer) {
      setError('Vui lòng chọn khách hàng');
      return;
    }

    if (cartItems.length === 0) {
      setError('Giỏ hàng trống');
      return;
    }

    const dto: CreateMasterOrderDto = {
      customerId: customer.id,
      branch,
      note: note || undefined,
      subOrders: [
        {
          serviceType,
          clearanceType: 'TIEU_NGACH',
          items: cartItems.map((item) => ({
            productName: item.title || 'Sản phẩm từ extension',
            productUrl: item.productUrl,
            quantity: item.quantity,
            unitPrice: item.price || 0,
            note: item.note || undefined,
          })),
        },
      ],
    };

    setLoading(true);
    try {
      const response: MessageResponse<{ id: string; code: string }> =
        await chrome.runtime.sendMessage({
          type: 'CREATE_ORDER',
          payload: dto,
        });

      if (response.success && response.data) {
        setOrderId(response.data.code || response.data.id);
      } else {
        setError(response.error || 'Lỗi tạo đơn hàng');
      }
    } catch (err) {
      setError('Lỗi kết nối tới ERP');
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (orderId) {
    return (
      <div className="popup-container" style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Tạo đơn thành công!</h2>
        <p className="text-sm text-muted" style={{ marginBottom: 4 }}>Mã đơn hàng:</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{orderId}</p>
        <button
          className="btn btn-primary btn-block mt-3"
          onClick={onSuccess}
        >
          Quay lại giỏ hàng
        </button>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">&larr;</button>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Tạo đơn hàng</h2>
      </div>

      <div className="text-sm text-muted mb-2">
        {cartItems.length} sản phẩm trong giỏ
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CustomerSearch
          selected={customer}
          onSelect={setCustomer}
          onClear={() => setCustomer(null)}
        />

        <div className="form-group">
          <label className="form-label">Chi nhánh *</label>
          <select
            className="form-select"
            value={branch}
            onChange={(e) => setBranch(e.target.value as Branch)}
          >
            {BRANCH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Loại dịch vụ</label>
          <select
            className="form-select"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
          >
            {SERVICE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Ghi chú</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ghi chú cho đơn hàng..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading || !customer}
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Đang tạo...' : 'Tạo đơn hàng'}
        </button>
      </form>
    </div>
  );
}
