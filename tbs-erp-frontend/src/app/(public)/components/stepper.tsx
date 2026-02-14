'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isFuture = stepNumber > currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200',
                    {
                      'bg-blue-600 text-white': isCompleted || isCurrent,
                      'bg-gray-200 text-gray-400': isFuture,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{stepNumber}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn('text-sm font-medium', {
                      'text-blue-600': isCompleted || isCurrent,
                      'text-gray-500': isFuture,
                    })}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-1 flex-1 mx-2 transition-all duration-200',
                    {
                      'bg-blue-600': stepNumber < currentStep,
                      'bg-gray-200': stepNumber >= currentStep,
                    }
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Vertical Stepper variant
interface VerticalStepperProps extends StepperProps {
  orientation?: 'vertical';
}

export function VerticalStepper({
  steps,
  currentStep,
  className,
}: VerticalStepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isFuture = stepNumber > currentStep;

          return (
            <div key={step.id} className="flex gap-4">
              {/* Step Circle and Line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200',
                    {
                      'bg-blue-600 text-white': isCompleted || isCurrent,
                      'bg-gray-200 text-gray-400': isFuture,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{stepNumber}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-1 flex-1 mt-2 min-h-[40px] transition-all duration-200',
                      {
                        'bg-blue-600': stepNumber < currentStep,
                        'bg-gray-200': stepNumber >= currentStep,
                      }
                    )}
                  />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pb-8">
                <h3
                  className={cn('text-base font-semibold', {
                    'text-blue-600': isCompleted || isCurrent,
                    'text-gray-500': isFuture,
                  })}
                >
                  {step.title}
                </h3>
                {step.description && (
                  <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
