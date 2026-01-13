// ============================================
// Agent Core - Main Agent Controller
// ============================================

import {
  AgentConfig,
  AgentState,
  AgentResponse,
  AgentEvent,
  AgentEventType,
  ExecutionPlan,
  StepResult,
  StateContext
} from '../types';
import { StateMachine } from './StateMachine';
import { CorePlanner } from './CorePlanner';
import { Executor } from './Executor';
import { ToolRegistry } from './ToolRegistry';
import { EventEmitter, generateId, formatDuration } from '../utils';

export class Agent extends EventEmitter {
  private stateMachine: StateMachine;
  private planner: CorePlanner;
  private executor: Executor;
  private toolRegistry: ToolRegistry;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    super();
    this.config = config;

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();
    if (config.tools) {
      this.toolRegistry.registerMany(config.tools);
    }
    this.toolRegistry.setLLM(config.llm);

    // Initialize components
    this.stateMachine = new StateMachine();
    this.planner = new CorePlanner(
      config.llm,
      config.plannerConfig,
      this.toolRegistry
    );
    this.executor = new Executor(this.toolRegistry, config.executorConfig);

    // Set up event forwarding
    this.setupEventForwarding();
  }

  // -------------------- Event Setup --------------------

  private setupEventForwarding(): void {
    // Forward state machine events
    this.stateMachine.on('transition', (data: any) => {
      this.emitAgentEvent('transition', data);
    });

    // Forward planner events
    this.planner.on('planning:start', (data: any) => {
      this.emitAgentEvent('status', { phase: 'planning', ...data });
    });

    this.planner.on('planning:complete', (data: any) => {
      this.emitAgentEvent('plan:created', data);
    });

    // Forward executor events
    this.executor.on('step:start', (data: any) => {
      this.emitAgentEvent('step:start', data);
    });

    this.executor.on('step:complete', (data: any) => {
      this.emitAgentEvent('step:complete', data);
    });

    this.executor.on('step:error', (data: any) => {
      this.emitAgentEvent('step:error', data);
    });

    this.executor.on('plan:progress', (data: any) => {
      this.emitAgentEvent('step:progress', data);
    });
  }

  private emitAgentEvent(type: AgentEventType, data: any): void {
    const event: AgentEvent = {
      type,
      timestamp: Date.now(),
      data
    };

    this.emit(type, data);
    this.emit('event', event);
    
    if (this.config.onEvent) {
      this.config.onEvent(event);
    }
  }

  // -------------------- Main Processing --------------------

  public async process(
    task: string,
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    // Check if already running
    if (this.stateMachine.isRunning()) {
      throw new Error('Agent is already processing a task');
    }

    try {
      // Start task
      this.stateMachine.dispatch('START_TASK', { task });
      this.emitAgentEvent('status', { 
        state: 'planning', 
        message: '正在分析任务...' 
      });

      // Create plan
      const plan = await this.planner.createPlan(task, context);
      this.stateMachine.setPlan(plan);
      
      this.emitAgentEvent('plan:created', { plan });

      // Transition to executing
      if (!this.stateMachine.dispatch('PLAN_READY')) {
        throw new Error('Failed to transition to EXECUTING state');
      }

      this.emitAgentEvent('status', { 
        state: 'executing', 
        message: `开始执行 ${plan.steps.length} 个步骤...` 
      });

      // Execute plan
      const { results, success, failedStep } = await this.executePlanWithEvents(plan, context);

      // Handle completion
      if (success) {
        this.stateMachine.dispatch('STEP_COMPLETE', { 
          result: results[results.length - 1] 
        });

        this.emitAgentEvent('task:complete', { success: true });

        return {
          success: true,
          taskId: this.stateMachine.getContext().taskId,
          plan,
          results,
          output: this.extractFinalOutput(results),
          summary: this.generateSummary(results),
          duration: Date.now() - startTime
        };
      } else {
        const error = results.find(r => r.stepId === failedStep)?.error;
        
        this.stateMachine.dispatch('EXECUTION_FAILED', { 
          error,
          result: results.find(r => r.stepId === failedStep)
        });

        this.emitAgentEvent('task:error', { error, failedStep });

        return {
          success: false,
          taskId: this.stateMachine.getContext().taskId,
          plan,
          results,
          error: error || new Error('Execution failed'),
          duration: Date.now() - startTime
        };
      }

    } catch (error) {
      this.stateMachine.dispatch('PLAN_FAILED', { error });
      
      this.emitAgentEvent('task:error', { error });

      return {
        success: false,
        taskId: this.stateMachine.getContext().taskId,
        error: error as Error,
        duration: Date.now() - startTime
      };
    }
  }

  // -------------------- Plan Execution with Events --------------------

  private async executePlanWithEvents(
    plan: ExecutionPlan,
    initialContext?: Record<string, any>
  ): Promise<{
    results: StepResult[];
    success: boolean;
    failedStep?: string;
  }> {
    const context = {
      taskId: plan.id,
      variables: { ...initialContext },
      stepResults: new Map<string, StepResult>()
    };

    const results: StepResult[] = [];
    let failedStep: string | undefined;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Update state machine
      this.stateMachine.updateContext({ currentStepIndex: i });

      // Check for confirmation requirement
      if (step.needConfirmation) {
        this.stateMachine.dispatch('NEED_CONFIRMATION', {
          reason: 'step_confirmation',
          data: { step, index: i }
        });

        this.emitAgentEvent('waiting:confirmation', {
          stepId: step.id,
          stepName: step.name,
          description: step.description
        });

        // Wait for user confirmation (in real app, this would be async)
        // For now, we auto-confirm
        this.stateMachine.dispatch('USER_CONFIRMED');
      }

      // Check dependencies
      const dependencyResults = this.checkDependencies(step, context.stepResults);
      if (dependencyResults.skip) {
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
      Object.assign(context.variables, dependencyResults.outputs);

      // Execute step
      const result = await this.executor.executeStep(step, context);
      results.push(result);
      context.stepResults.set(step.id, result);

      // Update context
      if (result.status === 'success' && result.output !== undefined) {
        context.variables[step.id] = result.output;
      }

      // Update state machine with result
      if (result.status === 'success') {
        // Only dispatch STEP_COMPLETE if not the last step
        if (i < plan.steps.length - 1) {
          this.stateMachine.dispatch('STEP_COMPLETE', { result });
        }
      } else if (result.status === 'failed') {
        failedStep = step.id;
        
        // Try to replan
        if (i < plan.steps.length - 1 && this.config.plannerConfig.enableParallel) {
          try {
            const replan = await this.planner.replan(
              plan, 
              step, 
              result.error!,
              context.variables
            );
            
            this.emitAgentEvent('plan:updated', { replan });
            
            // Continue with new plan
            // (simplified - in production would be more sophisticated)
          } catch (replanError) {
            // Replan failed, stop execution
            break;
          }
        }
        break;
      } else if (result.status === 'cancelled') {
        failedStep = step.id;
        break;
      }
    }

    return {
      results,
      success: !failedStep,
      failedStep
    };
  }

  private checkDependencies(
    step: any,
    stepResults: Map<string, StepResult>
  ): { skip: boolean; outputs: Record<string, any> } {
    const outputs: Record<string, any> = {};

    if (!step.dependsOn || step.dependsOn.length === 0) {
      return { skip: false, outputs };
    }

    for (const depId of step.dependsOn) {
      const depResult = stepResults.get(depId);
      
      if (!depResult) {
        // Dependency not executed yet - shouldn't happen with topological sort
        return { skip: true, outputs };
      }

      if (depResult.status !== 'success') {
        return { skip: true, outputs };
      }

      if (depResult.output !== undefined) {
        outputs[depId] = depResult.output;
      }
    }

    return { skip: false, outputs };
  }

  // -------------------- Output Processing --------------------

  protected extractFinalOutput(results: StepResult[]): any {
    // Get output from last successful step
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].status === 'success' && results[i].output !== undefined) {
        return results[i].output;
      }
    }
    return null;
  }

  protected generateSummary(results: StepResult[]): string {
    const stats = this.executor.getStatistics(results);
    
    const lines = [
      `执行完成:`,
      `  - 总步骤: ${stats.totalSteps}`,
      `  - 成功: ${stats.successful}`,
      `  - 失败: ${stats.failed}`,
      `  - 跳过: ${stats.skipped}`,
      `  - 总耗时: ${formatDuration(stats.totalDuration)}`
    ];

    return lines.join('\n');
  }

  // -------------------- Control Methods --------------------

  public cancel(): void {
    this.executor.cancel();
    this.stateMachine.dispatch('CANCEL');
    this.emitAgentEvent('status', { state: 'cancelled', message: '任务已取消' });
  }

  public pause(): void {
    this.executor.pause();
    this.emitAgentEvent('status', { state: 'paused', message: '执行已暂停' });
  }

  public resume(): void {
    this.executor.resume();
    this.emitAgentEvent('status', { state: 'executing', message: '继续执行...' });
  }

  public reset(): void {
    this.executor.cancel();
    this.stateMachine.reset();
    this.emitAgentEvent('status', { state: 'idle', message: '已重置' });
  }

  public confirm(data?: any): void {
    if (this.stateMachine.isWaiting()) {
      this.stateMachine.dispatch('USER_CONFIRMED', data);
    }
  }

  public reject(reason?: string): void {
    if (this.stateMachine.isWaiting()) {
      this.stateMachine.dispatch('USER_REJECTED', { reason });
    }
  }

  // -------------------- State Access --------------------

  public getState(): AgentState {
    return this.stateMachine.getState();
  }

  public getContext(): Readonly<StateContext> {
    return this.stateMachine.getContext();
  }

  public isIdle(): boolean {
    return this.stateMachine.isIdle();
  }

  public isRunning(): boolean {
    return this.stateMachine.isRunning();
  }

  public isWaiting(): boolean {
    return this.stateMachine.isWaiting();
  }

  // -------------------- Tool Management --------------------

  public registerTool(tool: any): void {
    this.toolRegistry.register(tool);
  }

  public getAvailableTools(): string[] {
    return this.toolRegistry.getToolNames();
  }

  // -------------------- Serialization --------------------

  public serialize(): string {
    return JSON.stringify({
      state: this.stateMachine.serialize(),
      config: {
        plannerConfig: this.config.plannerConfig,
        executorConfig: this.config.executorConfig
      }
    });
  }
}

// -------------------- Factory Function --------------------

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}
