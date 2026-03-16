import { useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../../types';
import type { MessageResponse } from '../../background/messages';

interface UseCartReturn {
  items: CartItem[];
  isLoading: boolean;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<CartItem>) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCart(): UseCartReturn {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response: MessageResponse<CartItem[]> = await chrome.runtime.sendMessage({
        type: 'GET_CART',
      });
      if (response.success && response.data) {
        setItems(response.data);
      }
    } catch {
      // Extension context lost
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for cart changes from other parts of the extension
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.cart) {
        setItems(changes.cart.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_FROM_CART',
      payload: { id },
    });
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<CartItem>) => {
    const response: MessageResponse<CartItem> = await chrome.runtime.sendMessage({
      type: 'UPDATE_CART_ITEM',
      payload: { id, updates },
    });
    if (response.success && response.data) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? response.data as CartItem : item)),
      );
    }
  }, []);

  const clearCart = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_CART' });
    setItems([]);
  }, []);

  return { items, isLoading, removeItem, updateItem, clearCart, refresh };
}
