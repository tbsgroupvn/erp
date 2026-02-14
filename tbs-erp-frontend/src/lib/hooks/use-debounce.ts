'use client';

import { useEffect, useState } from 'react';

/**
 * Debounces a value by the specified delay (in milliseconds).
 * Useful for delaying search input until the user stops typing.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 400);
 * // use debouncedSearch as the query param
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
