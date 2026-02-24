'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// SkipToContent — Hidden link that becomes visible on focus for keyboard users
// ---------------------------------------------------------------------------
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Chuyen den noi dung chinh
    </a>
  );
}

// ---------------------------------------------------------------------------
// VisuallyHidden — Renders content only for screen readers
// ---------------------------------------------------------------------------
interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: React.ElementType;
}

export function VisuallyHidden({
  children,
  as: Component = 'span',
}: VisuallyHiddenProps) {
  return <Component className="sr-only">{children}</Component>;
}

// ---------------------------------------------------------------------------
// useAnnounce — Hook to announce messages to screen readers via aria-live
// ---------------------------------------------------------------------------
const ANNOUNCER_ID = 'a11y-announcer';

/**
 * Announce a message to screen readers using an aria-live region.
 * The message is injected into a shared live region element in the DOM.
 */
export function useAnnounce() {
  const announce = React.useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (typeof document === 'undefined') return;

      let announcer = document.getElementById(ANNOUNCER_ID);

      if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = ANNOUNCER_ID;
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.setAttribute('role', 'status');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);
      } else {
        announcer.setAttribute('aria-live', priority);
      }

      // Clear and re-set to trigger announcement
      announcer.textContent = '';
      requestAnimationFrame(() => {
        if (announcer) {
          announcer.textContent = message;
        }
      });
    },
    [],
  );

  return { announce };
}

// ---------------------------------------------------------------------------
// AriaLiveRegion — Persistent live region component for root layout
// ---------------------------------------------------------------------------
export function AriaLiveRegion() {
  return (
    <>
      <div
        id="a11y-announcer"
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      />
      <div
        id="a11y-announcer-assertive"
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// FocusTrap helper — traps focus within a container (for custom modals)
// ---------------------------------------------------------------------------
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = container.querySelectorAll(focusableSelector);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0] as HTMLElement;
      const lastFocusable = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef]);
}
