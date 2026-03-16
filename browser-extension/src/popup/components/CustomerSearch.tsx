import { useState, useEffect, useRef } from 'react';
import type { ERPCustomer } from '../../types';
import type { MessageResponse } from '../../background/messages';
import type { PaginatedResponse } from '../../types/api';

interface CustomerSearchProps {
  onSelect: (customer: ERPCustomer) => void;
  selected: ERPCustomer | null;
  onClear: () => void;
}

export function CustomerSearch({ onSelect, selected, onClear }: CustomerSearchProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ERPCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response: MessageResponse<PaginatedResponse<ERPCustomer>> =
          await chrome.runtime.sendMessage({
            type: 'SEARCH_CUSTOMERS',
            payload: { search: search.trim(), limit: 8 },
          });

        if (response.success && response.data) {
          setResults(response.data.data || []);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [search]);

  if (selected) {
    return (
      <div className="form-group">
        <label className="form-label">Khách hàng *</label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#f9fafb',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.fullName}</div>
            <div className="text-xs text-muted">{selected.code}</div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="btn btn-secondary btn-sm"
          >
            Đổi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="form-label">Khách hàng *</label>
      <input
        type="text"
        className="form-input"
        placeholder="Tìm theo tên, mã, SĐT..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
      />

      {showDropdown && (search.trim() || loading) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {loading ? (
            <div style={{ padding: 12, textAlign: 'center' }}>
              <span className="spinner" />
            </div>
          ) : results.length > 0 ? (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onSelect(customer);
                  setSearch('');
                  setShowDropdown(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = 'none';
                }}
              >
                <div style={{ fontWeight: 500 }}>{customer.fullName}</div>
                <div className="text-xs text-muted">
                  {customer.code}
                  {customer.phone && ` - ${customer.phone}`}
                </div>
              </button>
            ))
          ) : search.trim() ? (
            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              Không tìm thấy
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
