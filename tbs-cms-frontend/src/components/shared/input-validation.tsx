import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputValidationProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  warning?: string;
  helperText?: string;
}

export const InputValidation = forwardRef<
  HTMLInputElement,
  InputValidationProps
>(
  (
    { label, error, success, warning, helperText, className, ...props },
    ref
  ) => {
    const hasError = !!error;
    const hasSuccess = success && !hasError;
    const hasWarning = !!warning && !hasError;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            className={cn(
              'w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
              hasError &&
                'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500',
              hasSuccess &&
                'border-green-300 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500',
              hasWarning &&
                'border-yellow-300 bg-yellow-50 text-yellow-900 focus:border-yellow-500 focus:ring-yellow-500',
              !hasError &&
                !hasSuccess &&
                !hasWarning &&
                'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
              className
            )}
            aria-invalid={hasError}
            aria-describedby={
              error
                ? `${props.id}-error`
                : warning
                  ? `${props.id}-warning`
                  : helperText
                    ? `${props.id}-helper`
                    : undefined
            }
            {...props}
          />

          {/* Validation icons */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            {hasError && (
              <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            )}
            {hasSuccess && (
              <CheckCircle2
                className="h-5 w-5 text-green-500"
                aria-hidden="true"
              />
            )}
            {hasWarning && (
              <AlertCircle
                className="h-5 w-5 text-yellow-500"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${props.id}-error`}
            className="mt-1.5 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Warning message */}
        {warning && !error && (
          <p
            id={`${props.id}-warning`}
            className="mt-1.5 text-sm text-yellow-600"
          >
            {warning}
          </p>
        )}

        {/* Helper text */}
        {helperText && !error && !warning && (
          <p id={`${props.id}-helper`} className="mt-1.5 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

InputValidation.displayName = 'InputValidation';
