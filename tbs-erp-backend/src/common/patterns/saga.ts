import { Logger } from '@nestjs/common';

export interface SagaStep<TContext> {
  name: string;
  execute: (context: TContext) => Promise<TContext>;
  compensate: (context: TContext) => Promise<TContext>;
}

export class SagaOrchestrator<TContext> {
  private readonly logger: Logger;
  private readonly steps: SagaStep<TContext>[] = [];

  constructor(private readonly name: string) {
    this.logger = new Logger(`Saga:${name}`);
  }

  addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  async execute(initialContext: TContext): Promise<TContext> {
    let context = { ...initialContext };
    const completedSteps: SagaStep<TContext>[] = [];

    for (const step of this.steps) {
      try {
        this.logger.log(`Executing step: ${step.name}`);
        context = await step.execute(context);
        completedSteps.push(step);
        this.logger.log(`Step completed: ${step.name}`);
      } catch (error) {
        this.logger.error(`Step failed: ${step.name} - ${error.message}`);

        // Compensate in reverse order
        for (let i = completedSteps.length - 1; i >= 0; i--) {
          const compensateStep = completedSteps[i];
          try {
            this.logger.warn(`Compensating step: ${compensateStep.name}`);
            context = await compensateStep.compensate(context);
            this.logger.log(`Compensation completed: ${compensateStep.name}`);
          } catch (compensateError) {
            this.logger.error(
              `Compensation FAILED for step: ${compensateStep.name} - ${compensateError.message}. Manual intervention required.`,
            );
          }
        }

        throw new SagaExecutionError(this.name, step.name, error, context);
      }
    }

    this.logger.log(`Saga "${this.name}" completed successfully`);
    return context;
  }
}

export class SagaExecutionError extends Error {
  constructor(
    public readonly sagaName: string,
    public readonly failedStep: string,
    public readonly originalError: Error,
    public readonly context: unknown,
  ) {
    super(`Saga "${sagaName}" failed at step "${failedStep}": ${originalError.message}`);
    this.name = 'SagaExecutionError';
  }
}
