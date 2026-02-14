'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';

export interface DraftData<T = any> {
  data: T;
  timestamp: number;
}

const DRAFT_EXPIRY_DAYS = 7;
const DRAFT_PREFIX = 'draft_';
const CLEANUP_INTERVAL_KEY = 'draft_last_cleanup';

export interface UseDraftOptions {
  key: string;
  autoSaveInterval?: number; // milliseconds, default 30000 (30s)
  enabled?: boolean;
  onQuotaExceeded?: () => void; // Callback when storage quota exceeded
}

// Zod schema for validating draft data structure
const DraftDataSchema = z.object({
  data: z.any(),
  timestamp: z.number(),
});

// SSR-safe check for localStorage availability
const isLocalStorageAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

// Check if cleanup should run (throttle to once per day)
const shouldRunCleanup = (): boolean => {
  if (!isLocalStorageAvailable()) return false;

  try {
    const lastCleanup = localStorage.getItem(CLEANUP_INTERVAL_KEY);
    if (!lastCleanup) return true;

    const lastTime = parseInt(lastCleanup, 10);
    const dayInMs = 24 * 60 * 60 * 1000;

    return (Date.now() - lastTime) > dayInMs;
  } catch {
    return true; // Run cleanup if we can't check
  }
};

// Cleanup old drafts from localStorage (throttled to once per day)
const cleanupOldDrafts = () => {
  if (!isLocalStorageAvailable() || !shouldRunCleanup()) return;

  try {
    const now = Date.now();
    const expiryTime = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in ms

    // Get all keys from localStorage
    const keys = Object.keys(localStorage);

    // Filter draft keys and check if expired
    keys.forEach((key) => {
      if (key.startsWith(DRAFT_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            // Validate structure before using
            const validated = DraftDataSchema.safeParse(parsed);
            if (validated.success) {
              if (now - validated.data.timestamp > expiryTime) {
                localStorage.removeItem(key);
                console.log(`Cleaned up expired draft: ${key}`);
              }
            } else {
              // Invalid structure, remove it
              localStorage.removeItem(key);
              console.warn(`Removed invalid draft: ${key}`);
            }
          }
        } catch (error) {
          // Invalid draft data, remove it
          localStorage.removeItem(key);
        }
      }
    });

    // Mark cleanup as done
    localStorage.setItem(CLEANUP_INTERVAL_KEY, Date.now().toString());
  } catch (error) {
    console.error('Failed to cleanup old drafts:', error);
  }
};

export function useDraft<T = any>(options: UseDraftOptions) {
  const { key, autoSaveInterval = 30000, enabled = true, onQuotaExceeded } = options;
  const storageKey = `${DRAFT_PREFIX}${key}`;

  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean>(false);

  // Track current auto-save interval to prevent race conditions
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if draft exists on mount and cleanup old drafts
  useEffect(() => {
    if (!enabled || !isLocalStorageAvailable()) return;

    try {
      // Cleanup old drafts first
      cleanupOldDrafts();

      // Then check if current draft exists
      const stored = localStorage.getItem(storageKey);
      setHasDraft(!!stored);
    } catch (error) {
      console.error('Failed to check draft:', error);
    }
  }, [storageKey, enabled]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Load draft from localStorage
  const loadDraft = useCallback((): T | null => {
    if (!enabled || !isLocalStorageAvailable()) return null;

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // Validate structure with Zod to prevent security issues
      const validated = DraftDataSchema.safeParse(parsed);

      if (!validated.success) {
        console.error('Invalid draft data structure:', validated.error);
        // Remove corrupted draft
        localStorage.removeItem(storageKey);
        return null;
      }

      return validated.data.data as T;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }, [storageKey, enabled]);

  // Save draft to localStorage
  const saveDraft = useCallback((data: T): boolean => {
    if (!enabled || !isLocalStorageAvailable()) return false;

    try {
      const draft: DraftData<T> = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setLastSaved(draft.timestamp);
      setHasDraft(true);
      return true;
    } catch (error) {
      // Handle QuotaExceededError specifically
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        console.error('localStorage quota exceeded, cleaning up old drafts...');

        // Try to cleanup old drafts and retry
        cleanupOldDrafts();

        try {
          const draft: DraftData<T> = {
            data,
            timestamp: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(draft));
          setLastSaved(draft.timestamp);
          setHasDraft(true);
          return true;
        } catch (retryError) {
          // Still failed after cleanup
          console.error('Failed to save draft even after cleanup:', retryError);

          // Call user-provided callback if available
          if (onQuotaExceeded) {
            onQuotaExceeded();
          }

          return false;
        }
      }

      console.error('Failed to save draft:', error);
      return false;
    }
  }, [storageKey, enabled, onQuotaExceeded]);

  // Clear draft from localStorage
  const clearDraft = useCallback((): void => {
    if (!isLocalStorageAvailable()) return;

    try {
      localStorage.removeItem(storageKey);
      setLastSaved(null);
      setHasDraft(false);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [storageKey]);

  // Auto-save functionality with proper cleanup
  const enableAutoSave = useCallback((getData: () => T | null): (() => void) => {
    if (!enabled || !isLocalStorageAvailable()) return () => {};

    // Clear any existing interval to prevent race conditions
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Create new interval
    intervalRef.current = setInterval(() => {
      const currentData = getData();

      // Only save if data is not null
      if (currentData !== null) {
        const saved = saveDraft(currentData);

        if (!saved) {
          console.warn('Auto-save failed, interval will continue trying...');
        }
      }
    }, autoSaveInterval);

    // Return cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, autoSaveInterval, saveDraft]);

  // Get draft metadata
  const getDraftMetadata = useCallback((): { timestamp: number | null; age: number | null } => {
    if (!isLocalStorageAvailable()) {
      return { timestamp: null, age: null };
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return { timestamp: null, age: null };

      const parsed = JSON.parse(stored);
      const validated = DraftDataSchema.safeParse(parsed);

      if (!validated.success) {
        return { timestamp: null, age: null };
      }

      return {
        timestamp: validated.data.timestamp,
        age: Date.now() - validated.data.timestamp,
      };
    } catch (error) {
      return { timestamp: null, age: null };
    }
  }, [storageKey]);

  return {
    hasDraft,
    lastSaved,
    loadDraft,
    saveDraft,
    clearDraft,
    enableAutoSave,
    getDraftMetadata,
  };
}
