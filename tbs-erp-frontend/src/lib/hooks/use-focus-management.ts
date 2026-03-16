'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// useFocusOnMount - Focus an element when a component mounts
// ---------------------------------------------------------------------------
/**
 * Returns a ref to attach to the element that should receive focus on mount.
 * Useful for modals, drawers, and page transitions.
 */
export function useFocusOnMount<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.focus({ preventScroll: false });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return ref;
}

// ---------------------------------------------------------------------------
// useFocusReturn - Return focus to the triggering element on unmount
// ---------------------------------------------------------------------------
/**
 * Captures the currently focused element on mount and restores focus
 * to it when the component unmounts. Ideal for modals and popovers.
 */
export function useFocusReturn() {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;

    return () => {
      // Return focus to the element that was focused before this component mounted
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        // Use requestAnimationFrame to ensure DOM has settled
        requestAnimationFrame(() => {
          (triggerRef.current as HTMLElement)?.focus();
        });
      }
    };
  }, []);

  return triggerRef;
}

// ---------------------------------------------------------------------------
// useRovingTabIndex - Keyboard navigation within lists/grids
// ---------------------------------------------------------------------------
interface UseRovingTabIndexOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Orientation of the list */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Whether navigation wraps around at edges */
  loop?: boolean;
  /** Initial focused index */
  initialIndex?: number;
}

/**
 * Implements the roving tabindex pattern for keyboard navigation
 * within a group of items (e.g., tabs, menu items, toolbar buttons).
 * Only the active item has tabIndex=0; all others have tabIndex=-1.
 */
export function useRovingTabIndex({
  itemCount,
  orientation = 'vertical',
  loop = true,
  initialIndex = 0,
}: UseRovingTabIndexOptions) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const setRef = useCallback((index: number) => (el: HTMLElement | null) => {
    itemRefs.current[index] = el;
  }, []);

  const focusItem = useCallback((index: number) => {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key } = event;
      let nextIndex = activeIndex;

      const isForward =
        (orientation !== 'horizontal' && key === 'ArrowDown') ||
        (orientation !== 'vertical' && key === 'ArrowRight');

      const isBackward =
        (orientation !== 'horizontal' && key === 'ArrowUp') ||
        (orientation !== 'vertical' && key === 'ArrowLeft');

      if (isForward) {
        event.preventDefault();
        nextIndex = activeIndex + 1;
        if (nextIndex >= itemCount) {
          nextIndex = loop ? 0 : itemCount - 1;
        }
      } else if (isBackward) {
        event.preventDefault();
        nextIndex = activeIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? itemCount - 1 : 0;
        }
      } else if (key === 'Home') {
        event.preventDefault();
        nextIndex = 0;
      } else if (key === 'End') {
        event.preventDefault();
        nextIndex = itemCount - 1;
      }

      if (nextIndex !== activeIndex) {
        focusItem(nextIndex);
      }
    },
    [activeIndex, itemCount, orientation, loop, focusItem],
  );

  const getItemProps = useCallback(
    (index: number) => ({
      ref: setRef(index),
      tabIndex: index === activeIndex ? 0 : -1,
      onKeyDown: handleKeyDown,
      'aria-selected': index === activeIndex,
    }),
    [activeIndex, handleKeyDown, setRef],
  );

  return {
    activeIndex,
    setActiveIndex: focusItem,
    getItemProps,
    handleKeyDown,
  };
}

// ---------------------------------------------------------------------------
// useFocusVisible - Detect keyboard vs mouse focus
// ---------------------------------------------------------------------------
/**
 * Returns whether the user is currently navigating with the keyboard.
 * Useful for applying focus-visible-like styles in JS when CSS :focus-visible
 * is insufficient.
 */
export function useFocusVisible() {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return { isFocusVisible: isKeyboardUser };
}
