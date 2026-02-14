import { useState, useEffect } from 'react';

/**
 * Hook to debounce a value
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns The debounced value
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);
 *
 * // Use debouncedSearchTerm for API calls
 * useEffect(() => {
 *   fetchResults(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
export function useDebouncedValue<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if value changes before delay expires
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
