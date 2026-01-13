// ============================================
// Agent Core - Executor
// ============================================

import {
  ExecutionStep,
  ExecutionPlan,
  StepResult,
  StepStatus,
  ExecutionContext,
  ExecutorConfig,
  ToolExecuteOptions
} from '../types';
import { ToolRegistry } from './ToolRegistry';
import {
  EventEmitter,
  delay,
  retry,
  resolveParams,
  evaluateCondition,
  formatDuration
} from '../utils';

export class Executor extends EventEmitter {
  private toolRegistry: ToolRegistry;
  private config: ExecutorConfig;
  private runningTasks: Map<string, AbortController> = new Map();
  private isPaused: boolean = false;

  constructor(toolRegistry: ToolRegistry, config: ExecutorConfig) {
    super();
    this.toolRegistry = toolRegistry;
    this.config = config;
  }

  // -------------------- Step Execution --------------------

  public async executeStep(
    step: ExecutionStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const startTime = Date.now();
    
    // Check if paused
    if (this.isPaused) {
      await this.waitForResume();
    }

    // Create abort controller for this step
    const abortController = new AbortController();
    this.runningTasks.set(step.id, abortController);

    this.emit('step:start', {
      stepId: step.id,
      stepName: step.name,
      type: step.type
    });

    try {
      // Execute with retry logic
      const maxRetries = step.retryable ? (step.maxRetries || this.config.maxRetries) : 0;
      
      const output = await retry(
        () => this.runStep(step, context, abortController.signal),
        {
          maxRetries,
          delay: this.config.retryDelay,
          onRetry: (error, attempt) => {
            this.emit('step:retry', {
              stepId: step.id,
              attempt,
              maxRetries,
              error: error.message
            });
          }
        }
      );

      const endTime = Date.now();
      const result: StepResult = {
        stepId: step.id,
        stepName: step.name,
        status: 'success',
        output,
        startTime,
        endTime,
        duration: endTime - startTime,
        retries: 0
      };

      this.emit('step:complete', { result });
      return result;

    } catch (error) {
      const endTime = Date.now();
      const result: StepResult = {
        stepId: step.id,
        stepName: step.name,
        status: abortController.signal.aborted ? 'cancelled' : 'failed',
        error: error as Error,
        startTime,
        endTime,
        duration: endTime - startTime,
        retries: step.retryable ? (step.maxRetries || this.config.maxRetries) : 0
      };

      this.emit('step:error', { result, error });
      return result;

    } finally {
      this.runningTasks.delete(step.id);
    }
  }

  // -------------------- Step Runner --------------------

  private async runStep(
    step: ExecutionStep,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any> {
    // Check abort before starting
    if (signal.aborted) {
      throw new Error('Step was cancelled');
    }

    // Set up timeout
    const timeoutMs = step.timeout || this.config.defaultTimeout;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    // Execute based on step type
    const executionPromise = (async () => {
      switch (step.type) {
        case 'tool':
          return this.executeToolStep(step, context, signal);
        
        case 'llm':
          return this.executeLLMStep(step, context, signal);
        
        case 'conditional':
          return this.executeConditionalStep(step, context);
        
        case 'loop':
          return this.executeLoopStep(step, context, signal);
        
        case 'parallel':
          return this.executeParallelStep(step, context, signal);
        
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }

  // -------------------- Tool Step --------------------

  private async executeToolStep(
    step: ExecutionStep,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any> {
    if (!step.tool) {
      throw new Error(`Tool step "${step.id}" missing tool name`);
    }

    // Resolve parameters with context variables
    const resolvedParams = resolveParams(step.params || {}, context.variables);

    this.emit('step:tool:call', {
      stepId: step.id,
      tool: step.tool,
      params: resolvedParams
    });

    const options: ToolExecuteOptions = {
      signal,
      timeout: step.timeout || this.config.defaultTimeout,
      context: context.variables
    };

    return this.toolRegistry.executeTool(step.tool, resolvedParams, options);
  }

  // -------------------- LLM Step --------------------

  private async executeLLMStep(
    step: ExecutionStep,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any> {
    const llm = this.toolRegistry.getLLM();

    // Build prompt from params
    const params = resolveParams(step.params || {}, context.variables);
    const prompt = params.prompt || params.text || step.description;

    if (!prompt) {
      throw new Error(`LLM step "${step.id}" missing prompt`);
    }

    this.emit('step:llm:call', {
      stepId: step.id,
      promptLength: prompt.length
    });

    const response = await llm.complete(prompt, { signal });

    // Parse response if format specified
    if (params.outputFormat === 'json') {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : response;
      } catch {
        return response;
      }
    }

    return response;
  }

  // -------------------- Conditional Step --------------------

  private async executeConditionalStep(
    step: ExecutionStep,
    context: ExecutionContext
  ): Promise<{ conditionMet: boolean; branch: string }> {
    if (!step.condition) {
      throw new Error(`Conditional step "${step.id}" missing condition`);
    }

    const conditionMet = evaluateCondition(step.condition, context.variables);

    this.emit('step:conditional', {
      stepId: step.id,
      condition: step.condition,
      result: conditionMet
    });

    return {
      conditionMet,
      branch: conditionMet ? 'true' : 'false'
    };
  }

  // -------------------- Loop Step --------------------

  private async executeLoopStep(
    step: ExecutionStep,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any[]> {
    const params = resolveParams(step.params || {}, context.variables);
    const items = params.items || params.iterateOver || [];

    if (!Array.isArray(items)) {
      throw new Error(`Loop step "${step.id}" items must be an array`);
    }

    const results: any[] = [];

    for (let i = 0; i < items.length; i++) {
      if (signal.aborted) break;

      const item = items[i];
      
      this.emit('step:loop:iteration', {
        stepId: step.id,
        index: i,
        total: items.length
      });

      // Execute child steps with item context
      if (step.children && step.children.length > 0) {
        const loopContext: ExecutionContext = {
          ...context,
          variables: {
            ...context.variables,
            $item: item,
            $index: i,
            $total: items.length
          }
        };

        const childResults = await this.executeChildren(step.children, loopContext, signal);
        results.push(childResults);
      } else {
        results.push(item);
      }
    }

    return results;
  }

  // -------------------- Parallel Step --------------------

  private async executeParallelStep(
    step: ExecutionStep,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any[]> {
    if (!step.children || step.children.length === 0) {
      return [];
    }

    const maxConcurrency = this.config.maxConcurrency;
    const results: any[] = new Array(step.children.length);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < step.children.length; i++) {
      if (signal.aborted) break;

      const childStep = step.children[i];
      const index = i;

      const promise = this.executeStep(childStep, context).then(result => {
        results[index] = result;
      });

      executing.push(promise);

      // Limit concurrency
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
        // Remove completed promises
        const completed = executing.findIndex(p => 
          Promise.race([p, Promise.resolve('pending')]).then(v => v !== 'pending')
        );
        if (completed !== -1) {
          executing.splice(completed, 1);
        }
      }
    }

    // Wait for all to complete
    await Promise.all(executing);

    return results;
  }

  // -------------------- Helper Methods --------------------

  private async executeChildren(
    children: ExecutionStep[],
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    for (const child of children) {
      if (signal.aborted) break;

      const result = await this.executeStep(child, context);
      results.push(result);

      // Update context with result
      if (result.status === 'success') {
        context.variables[child.id] = result.output;
      }
    }

    return results;
  }

  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (!this.isPaused) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // -------------------- Control Methods --------------------

  public pause(): void {
    this.isPaused = true;
    this.emit('executor:paused', {});
  }

  public resume(): void {
    this.isPaused = false;
    this.emit('executor:resumed', {});
  }

  public cancel(stepId?: string): void {
    if (stepId) {
      const controller = this.runningTasks.get(stepId);
      if (controller) {
        controller.abort();
        this.emit('step:cancelled', { stepId });
      }
    } else {
      // Cancel all running tasks
      this.runningTasks.forEach((controller, id) => {
        controller.abort();
        this.emit('step:cancelled', { stepId: id });
      });
    }
  }

  public getRunningSteps(): string[] {
    return Array.from(this.runningTasks.keys());
  }

  public isStepRunning(stepId: string): boolean {
    return this.runningTasks.has(stepId);
  }

  // -------------------- Plan Execution --------------------

  public async executePlan(
    plan: ExecutionPlan,
    initialContext?: Record<string, any>
  ): Promise<{
    results: StepResult[];
    success: boolean;
    failedStep?: string;
  }> {
    const context: ExecutionContext = {
      taskId: plan.id,
      variables: { ...initialContext },
      stepResults: new Map()
    };

    const results: StepResult[] = [];
    let failedStep: string | undefined;

    this.emit('plan:start', { planId: plan.id, stepCount: plan.steps.length });

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      this.emit('plan:progress', {
        planId: plan.id,
        currentStep: i + 1,
        totalSteps: plan.steps.length,
        stepName: step.name
      });

      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const dependencyFailed = step.dependsOn.some(depId => {
          const depResult = context.stepResults.get(depId);
          return depResult && depResult.status !== 'success';
        });

        if (dependencyFailed) {
          results.push({
            stepId: step.id,
            stepName: step.name,
            status: 'skipped',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            retries: 0
          });
          continue;
        }

        // Add dependency outputs to context
        step.dependsOn.forEach(depId => {
          const depResult = context.stepResults.get(depId);
          if (depResult && depResult.output !== undefined) {
            context.variables[depId] = depResult.output;
          }
        });
      }

      // Execute step
      const result = await this.executeStep(step, context);
      results.push(result);
      context.stepResults.set(step.id, result);

      // Update context with result
      if (result.status === 'success' && result.output !== undefined) {
        context.variables[step.id] = result.output;
      }

      // Check for failure
      if (result.status === 'failed') {
        failedStep = step.id;
        this.emit('plan:failed', {
          planId: plan.id,
          failedStep: step.id,
          error: result.error
        });
        break;
      }

      if (result.status === 'cancelled') {
        failedStep = step.id;
        break;
      }
    }

    const success = !failedStep;

    this.emit('plan:complete', {
      planId: plan.id,
      success,
      results: results.map(r => ({
        stepId: r.stepId,
        status: r.status,
        duration: r.duration
      }))
    });

    return { results, success, failedStep };
  }

  // -------------------- Statistics --------------------

  public getStatistics(results: StepResult[]): {
    totalSteps: number;
    successful: number;
    failed: number;
    skipped: number;
    cancelled: number;
    totalDuration: number;
    averageDuration: number;
  } {
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const cancelled = results.filter(r => r.status === 'cancelled').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalSteps: results.length,
      successful,
      failed,
      skipped,
      cancelled,
      totalDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0
    };
  }
}
