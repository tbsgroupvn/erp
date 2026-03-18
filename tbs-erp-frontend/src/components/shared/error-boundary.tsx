'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/lib/stores/auth-store';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * @example
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * @example With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    const userRole = useAuthStore.getState().user?.role;
    Sentry.captureException(error, {
      level: 'error',
      tags: { boundary: 'component', userRole: userRole || 'unknown' },
      extra: { path: typeof window !== 'undefined' ? window.location.pathname : 'ssr' },
      contexts: {
        react: { componentStack: errorInfo.componentStack || '' },
      },
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>

            <h2 className="mb-2 text-lg font-semibold text-red-900">
              Đã xảy ra lỗi
            </h2>

            <p className="mb-4 text-sm text-red-700">
              Rất tiếc, có lỗi xảy ra khi hiển thị nội dung này. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu vấn đề tiếp diễn.
            </p>

            {/* Show error message in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 rounded bg-red-100 p-3 text-left">
                <summary className="cursor-pointer text-xs font-medium text-red-800">
                  Chi tiết lỗi (chỉ hiện trong development)
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-900">
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>

              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap any component with an error boundary
 *
 * @example
 * const SafeComponent = withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
