'use client';

import React from 'react';

/**
 * A11yDevTools - Integrates @axe-core/react for automated accessibility
 * testing in development mode. Logs accessibility violations to the console.
 *
 * This component renders nothing and only activates in development.
 * Place it once in the root layout.
 */
export function A11yDevTools() {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Dynamically import to avoid bundling in production
      Promise.all([
        import('@axe-core/react'),
        import('react-dom'),
      ]).then(([axe, ReactDOM]) => {
        axe.default(React, ReactDOM, 1000, {
          rules: [
            // Enforce WCAG AA contrast requirements
            { id: 'color-contrast', enabled: true },
            // Ensure images have alt text
            { id: 'image-alt', enabled: true },
            // Ensure buttons have accessible names
            { id: 'button-name', enabled: true },
            // Ensure links have accessible names
            { id: 'link-name', enabled: true },
            // Ensure form elements have labels
            { id: 'label', enabled: true },
          ],
        });
      }).catch(() => {
        // @axe-core/react not installed - skip silently
      });
    }
  }, []);

  return null;
}
