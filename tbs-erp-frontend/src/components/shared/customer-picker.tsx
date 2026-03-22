'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { useCustomers } from '@/lib/hooks/use-customers';

export interface CustomerPickerValue {
  id: string;
  code: string;
  fullName: string;
  companyName?: string | null;
  phone?: string | null;
  tier?: string | null;
}

export interface CustomerPickerProps {
  /** Currently selected customer id (null = nothing selected) */
  value: string | null;
  /** Called when a customer is selected or cleared */
  onChange: (customer: CustomerPickerValue | null) => void;
  /** Validation error message */
  error?: string;
  /** Field label (default: "Kh\u00e1ch h\u00e0ng *") */
  label?: string;
  /** Disable the picker */
  disabled?: boolean;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Additional class name for the root wrapper */
  className?: string;
  /**
   * If the caller already has the full customer object it can pass it in so the
   * picker can display name/code without an extra fetch.
   */
  selectedCustomer?: CustomerPickerValue | null;
}

export function CustomerPicker({
  value,
  onChange,
  error,
  label = 'Kh\u00e1ch h\u00e0ng *',
  disabled = false,
  placeholder = 'T\u00ecm kh\u00e1ch h\u00e0ng theo t\u00ean, m\u00e3, S\u0110T...',
  className,
  selectedCustomer: externalSelected,
}: CustomerPickerProps) {
  // ---- internal state ----
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [internalSelected, setInternalSelected] = useState<CustomerPickerValue | null>(
    externalSelected ?? null,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external selected customer prop
  useEffect(() => {
    if (externalSelected !== undefined) {
      setInternalSelected(externalSelected ?? null);
    }
  }, [externalSelected]);

  // Clear internal selection if value becomes null/empty from outside
  useEffect(() => {
    if (!value) {
      setInternalSelected(null);
    }
  }, [value]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch customers
  const { data: customersData, isLoading } = useCustomers(
    debouncedSearch ? { search: debouncedSearch, limit: 10 } : { limit: 10 },
  );

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (customer: CustomerPickerValue) => {
      setInternalSelected(customer);
      setSearch('');
      setShowDropdown(false);
      onChange(customer);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setInternalSelected(null);
    setSearch('');
    setShowDropdown(true);
    onChange(null);
  }, [onChange]);

  const selected = internalSelected;

  return (
    <div className={className}>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div className="relative" ref={dropdownRef}>
        {selected ? (
          <div className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
            <span>
              {selected.fullName}{' '}
              <span className="text-muted-foreground">({selected.code})</span>
              {selected.companyName && (
                <span className="text-muted-foreground"> — {selected.companyName}</span>
              )}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="ml-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              disabled={disabled}
              className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </>
        )}

        {/* Dropdown */}
        {showDropdown && !selected && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">{'\u0110ang t\u00ecm...'}</span>
              </div>
            ) : customersData?.data && customersData.data.length > 0 ? (
              <ul className="py-1">
                {customersData.data.map((customer: any) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(customer as CustomerPickerValue)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <div>
                        <div className="font-medium">{customer.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {customer.code}
                          {customer.phone && ` - ${customer.phone}`}
                          {customer.companyName && ` - ${customer.companyName}`}
                          {customer.tier && ` (${customer.tier})`}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {search ? 'Kh\u00f4ng t\u00ecm th\u1ea5y kh\u00e1ch h\u00e0ng' : 'Nh\u1eadp \u0111\u1ec3 t\u00ecm kh\u00e1ch h\u00e0ng'}
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
