'use client';

export interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div
            className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-sm font-medium ${
              i <= currentStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs sm:text-sm whitespace-nowrap ${
              i <= currentStep ? 'font-medium' : 'text-muted-foreground'
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && <div className="h-px w-4 sm:w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}
