// ============================================
// Agent Core - Persistent Agent
// ============================================

import {
  AgentConfig,
  AgentState,
  AgentResponse,
  ExecutionPlan,
  StepResult,
  StateContext
} from '../types';
import { Agent } from '../core/Agent';
import { PersistenceManager } from './PersistenceManager';
import { 
  StorageAdapter, 
  PersistedTask, 
  Checkpoint,
  ExecutionRecord,
  PersistenceConfig 
} from './types';
import { generateId } from '../utils';

export interface PersistentAgentConfig extends AgentConfig {
  persistence: PersistenceConfig;
  autoCheckpoint?: boolean;
  checkpointOnStep?: boolean;
}

export class PersistentAgent extends Agent {
  private persistence: PersistenceManager;
  private currentTaskId: string | null = null;
  private autoCheckpoint: boolean;
  private checkpointOnStep: boolean;
  private lastCheckpointTime: number = 0;

  constructor(config: PersistentAgentConfig) {
    super(config);
    
    this.persistence = new PersistenceManager(config.persistence);
    this.autoCheckpoint = config.autoCheckpoint ?? true;
    this.checkpointOnStep = config.checkpointOnStep ?? true;

    this.setupPersistenceHooks();
  }

  // -------------------- Initialization --------------------

  async initialize(): Promise<void> {
    await this.persistence.initialize();
    this.emit('persistence:initialized', {});
  }

  async shutdown(): Promise<void> {
    await this.saveCurrentTask();
    await this.persistence.shutdown();
    this.emit('persistence:shutdown', {});
  }

  // -------------------- Persistence Hooks --------------------

  private setupPersistenceHooks(): void {
    // Save task when plan is created
    this.on('plan:created', async ({ plan }) => {
      if (this.currentTaskId) {
        await this.persistence.savePlanVersion(
          this.currentTaskId,
          plan,
          'initial'
        );
      }
    });

    // Save task on plan update (replan)
    this.on('plan:updated', async ({ replan }) => {
      if (this.currentTaskId) {
        const versions = await this.persistence.getPlanVersions(this.currentTaskId);
        const parentId = versions.length > 0 ? versions[versions.length - 1].id : undefined;
        
        await this.persistence.savePlanVersion(
          this.currentTaskId,
          replan,
          'replan',
          parentId
        );
      }
    });

    // Record step execution and create checkpoint
    this.on('step:complete', async ({ result }) => {
      if (this.currentTaskId) {
        // Record execution
        await this.recordStepExecution(result);
        
        // Create checkpoint if enabled
        if (this.checkpointOnStep) {
          await this.createCheckpoint();
        }
      }
    });

    // Save on error
    this.on('step:error', async ({ result }) => {
      if (this.currentTaskId) {
        await this.recordStepExecution(result);
        await this.saveCurrentTask();
      }
    });

    // Save on completion
    this.on('task:complete', async () => {
      await this.saveCurrentTask();
    });

    // Save on error
    this.on('task:error', async () => {
      await this.saveCurrentTask();
    });
  }

  // -------------------- Task Processing --------------------

  async process(
    task: string,
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    // Generate task ID
    this.currentTaskId = generateId('task');
    
    // Create initial persisted task
    const persistedTask: PersistedTask = {
      id: this.currentTaskId,
      description: task,
      status: 'pending',
      state: AgentState.IDLE,
      plan: null,
      context: context || {},
      results: [],
      currentStepIndex: -1,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      metadata: {}
    };

    await this.persistence.saveTask(persistedTask);

    // Process with parent
    const response = await super.process(task, context);

    // Update task ID in response
    response.taskId = this.currentTaskId;

    return response;
  }

  // -------------------- Task Resume --------------------

  async resumeTask(taskId: string): Promise<AgentResponse> {
    const resumeData = await this.persistence.getResumeData(taskId);
    
    if (!resumeData) {
      throw new Error(`Cannot resume task ${taskId}: no valid checkpoint found`);
    }

    const { task, checkpoint, remainingSteps } = resumeData;

    this.currentTaskId = taskId;

    // Update task status
    task.status = 'executing';
    task.state = AgentState.EXECUTING;
    task.updatedAt = Date.now();
    await this.persistence.saveTask(task);

    this.emit('task:resumed', {
      taskId,
      fromStep: checkpoint.stepIndex,
      remainingSteps
    });

    // Resume execution from checkpoint
    const response = await this.resumeFromCheckpoint(task, checkpoint);
    
    response.taskId = taskId;
    return response;
  }

  private async resumeFromCheckpoint(
    task: PersistedTask,
    checkpoint: Checkpoint
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!task.plan) {
      throw new Error('Cannot resume: task has no plan');
    }

    try {
      // Restore state
      const contextData = this.persistence.restoreContextFromTask(task);
      
      // Get remaining steps
      const remainingSteps = task.plan.steps.slice(checkpoint.stepIndex + 1);
      
      if (remainingSteps.length === 0) {
        return {
          success: true,
          taskId: task.id,
          plan: task.plan,
          results: checkpoint.results,
          summary: 'Task already completed',
          duration: Date.now() - startTime
        };
      }

      // Create partial plan for remaining steps
      const partialPlan: ExecutionPlan = {
        ...task.plan,
        id: generateId('resume'),
        steps: remainingSteps,
        metadata: {
          ...task.plan.metadata,
          resumed: true,
          resumedFrom: checkpoint.id,
          originalStepCount: task.plan.steps.length
        }
      };

      // Execute remaining steps
      // Note: This would call the executor directly with the partial plan
      // For simplicity, we're using a simplified approach here
      
      const results = [...checkpoint.results];
      const context = { ...checkpoint.context };

      // Set up context with previous results
      for (const result of results) {
        if (result.status === 'success' && result.output !== undefined) {
          context[result.stepId] = result.output;
        }
      }

      this.emit('status', { 
        state: 'executing', 
        message: `Resuming from step ${checkpoint.stepIndex + 1}...` 
      });

      // Execute remaining steps using the executor
      const executionResult = await this.executeRemainingSteps(
        partialPlan,
        context,
        results
      );

      // Update task
      task.status = executionResult.success ? 'completed' : 'failed';
      task.state = executionResult.success ? AgentState.COMPLETE : AgentState.ERROR;
      task.results = executionResult.results;
      task.completedAt = Date.now();
      task.updatedAt = Date.now();
      await this.persistence.saveTask(task);

      return {
        success: executionResult.success,
        taskId: task.id,
        plan: task.plan,
        results: executionResult.results,
        output: this.extractFinalOutput(executionResult.results),
        summary: this.generateSummary(executionResult.results),
        error: executionResult.error,
        duration: Date.now() - startTime
      };

    } catch (error) {
      task.status = 'failed';
      task.state = AgentState.ERROR;
      task.error = {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      };
      task.updatedAt = Date.now();
      await this.persistence.saveTask(task);

      return {
        success: false,
        taskId: task.id,
        error: error as Error,
        duration: Date.now() - startTime
      };
    }
  }

  private async executeRemainingSteps(
    plan: ExecutionPlan,
    initialContext: Record<string, any>,
    previousResults: StepResult[]
  ): Promise<{
    results: StepResult[];
    success: boolean;
    error?: Error;
  }> {
    // This would use the internal executor
    // For now, returning a placeholder
    return {
      results: previousResults,
      success: true
    };
  }

  // -------------------- Checkpoint Management --------------------

  async createCheckpoint(): Promise<Checkpoint | null> {
    if (!this.currentTaskId) return null;

    const context = this.getContext();
    const results = context.results || [];

    const checkpoint = await this.persistence.createCheckpoint(
      this.currentTaskId,
      context,
      results
    );

    this.lastCheckpointTime = Date.now();
    this.emit('checkpoint:created', { checkpoint });

    return checkpoint;
  }

  async getCheckpoints(taskId?: string): Promise<Checkpoint[]> {
    const id = taskId || this.currentTaskId;
    if (!id) return [];
    return this.persistence.getTaskCheckpoints(id);
  }

  // -------------------- Execution Recording --------------------

  private async recordStepExecution(result: StepResult): Promise<void> {
    if (!this.currentTaskId) return;

    const context = this.getContext();
    const step = context.plan?.steps.find(s => s.id === result.stepId);

    const record: ExecutionRecord = {
      id: generateId('exec'),
      taskId: this.currentTaskId,
      stepId: result.stepId,
      stepName: result.stepName,
      type: step?.type || 'unknown',
      status: result.status as any,
      input: step?.params || {},
      output: result.output,
      error: result.error ? {
        name: result.error.name,
        message: result.error.message,
        stack: result.error.stack
      } : null,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.duration,
      retries: result.retries,
      metadata: {}
    };

    await this.persistence.recordExecution(record);
  }

  // -------------------- Task Management --------------------

  async saveCurrentTask(): Promise<void> {
    if (!this.currentTaskId) return;

    const context = this.getContext();
    const task = this.persistence.createTaskFromContext(
      this.currentTaskId,
      context.task,
      context
    );

    await this.persistence.saveTask(task);
  }

  async loadTask(taskId: string): Promise<PersistedTask | null> {
    return this.persistence.loadTask(taskId);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.persistence.deleteTask(taskId);
  }

  async listTasks(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersistedTask[]> {
    return this.persistence.queryTasks({
      status: options?.status as any,
      limit: options?.limit,
      offset: options?.offset
    });
  }

  async getTaskHistory(taskId: string): Promise<ExecutionRecord[]> {
    const history = await this.persistence.getTaskHistory(taskId);
    return history.records;
  }

  // -------------------- Plan Versioning --------------------

  async getPlanVersions(taskId?: string): Promise<any[]> {
    const id = taskId || this.currentTaskId;
    if (!id) return [];
    return this.persistence.getPlanVersions(id);
  }

  // -------------------- Statistics --------------------

  async getStatistics(): Promise<any> {
    return this.persistence.getStatistics();
  }

  // -------------------- Cleanup --------------------

  async cleanup(): Promise<void> {
    await this.persistence.cleanup();
  }

  // -------------------- Utility Methods --------------------

  // Note: extractFinalOutput is inherited from Agent (protected)

  protected override generateSummary(results: StepResult[]): string {
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return `执行完成: ${successful} 成功, ${failed} 失败, ${skipped} 跳过 (${totalDuration}ms)`;
  }

  // -------------------- Getters --------------------

  get persistenceManager(): PersistenceManager {
    return this.persistence;
  }

  get currentTask(): string | null {
    return this.currentTaskId;
  }
}

// -------------------- Factory --------------------

export function createPersistentAgent(config: PersistentAgentConfig): PersistentAgent {
  return new PersistentAgent(config);
}
