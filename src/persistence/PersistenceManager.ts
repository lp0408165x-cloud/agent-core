// ============================================
// Agent Core - Persistence Manager
// ============================================

import {
  StorageAdapter,
  PersistedTask,
  TaskStatus,
  SerializedError,
  ExecutionRecord,
  TaskHistory,
  Checkpoint,
  PlanVersion,
  TaskQueryOptions,
  HistoryQueryOptions,
  PersistenceConfig,
  PersistenceEvent
} from './types';
import { ExecutionPlan, StepResult, AgentState, StateContext } from '../types';
import { EventEmitter, generateId } from '../utils';

export class PersistenceManager extends EventEmitter {
  private adapter: StorageAdapter;
  private keyPrefix: string;
  private config: PersistenceConfig;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private pendingChanges: Map<string, PersistedTask> = new Map();

  // Key prefixes for different data types
  private readonly KEYS = {
    TASK: 'task:',
    HISTORY: 'history:',
    CHECKPOINT: 'checkpoint:',
    PLAN_VERSION: 'planversion:',
    INDEX: 'index:'
  };

  constructor(config: PersistenceConfig) {
    super();
    this.adapter = config.adapter;
    this.keyPrefix = config.keyPrefix || 'agentcore:';
    this.config = {
      checkpointInterval: 30000,      // 30 seconds
      checkpointRetention: 86400000,  // 24 hours
      historyRetention: 604800000,    // 7 days
      enableAutoSave: true,
      enableCompression: false,
      ...config
    };
  }

  // -------------------- Lifecycle --------------------

  async initialize(): Promise<void> {
    await this.adapter.connect();
    
    if (this.config.enableAutoSave) {
      this.startAutoSave();
    }

    // Clean up expired data
    await this.cleanup();
    
    this.emit('initialized', {});
  }

  async shutdown(): Promise<void> {
    this.stopAutoSave();
    await this.flush();
    await this.adapter.disconnect();
    this.emit('shutdown', {});
  }

  // -------------------- Task Persistence --------------------

  async saveTask(task: PersistedTask): Promise<void> {
    const key = this.getKey(this.KEYS.TASK, task.id);
    
    task.updatedAt = Date.now();
    
    await this.adapter.set(key, task);
    
    // Update index
    await this.updateTaskIndex(task);
    
    this.emitEvent('save', task.id, true);
  }

  async loadTask(taskId: string): Promise<PersistedTask | null> {
    const key = this.getKey(this.KEYS.TASK, taskId);
    const task = await this.adapter.get<PersistedTask>(key);
    
    if (task) {
      this.emitEvent('load', taskId, true);
    }
    
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const key = this.getKey(this.KEYS.TASK, taskId);
    const deleted = await this.adapter.delete(key);
    
    // Also delete related data
    await this.deleteTaskHistory(taskId);
    await this.deleteTaskCheckpoints(taskId);
    await this.deleteTaskPlanVersions(taskId);
    
    // Update index
    await this.removeFromTaskIndex(taskId);
    
    if (deleted) {
      this.emitEvent('delete', taskId, true);
    }
    
    return deleted;
  }

  async queryTasks(options: TaskQueryOptions = {}): Promise<PersistedTask[]> {
    const pattern = this.getKey(this.KEYS.TASK, '*');
    const keys = await this.adapter.keys(pattern);
    
    const tasks = await Promise.all(
      keys.map(key => this.adapter.get<PersistedTask>(key))
    );

    let filtered = tasks.filter((t): t is PersistedTask => t !== null);

    // Apply filters
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filtered = filtered.filter(t => statuses.includes(t.status));
    }

    if (options.fromDate) {
      filtered = filtered.filter(t => t.createdAt >= options.fromDate!);
    }

    if (options.toDate) {
      filtered = filtered.filter(t => t.createdAt <= options.toDate!);
    }

    // Sort
    const orderBy = options.orderBy || 'createdAt';
    const orderDir = options.orderDirection || 'desc';
    
    filtered.sort((a, b) => {
      const aVal = a[orderBy] || 0;
      const bVal = b[orderBy] || 0;
      return orderDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  async getTaskCount(status?: TaskStatus): Promise<number> {
    const tasks = await this.queryTasks({ status, limit: 10000 });
    return tasks.length;
  }

  // -------------------- State Context Conversion --------------------

  createTaskFromContext(
    taskId: string,
    description: string,
    context: StateContext
  ): PersistedTask {
    return {
      id: taskId,
      description,
      status: this.stateToStatus(context.state),
      state: context.state,
      plan: context.plan,
      context: context.metadata,
      results: context.results,
      currentStepIndex: context.currentStepIndex,
      error: context.error ? this.serializeError(context.error) : null,
      createdAt: context.startTime || Date.now(),
      updatedAt: Date.now(),
      completedAt: context.state === AgentState.COMPLETE ? Date.now() : null,
      metadata: {}
    };
  }

  restoreContextFromTask(task: PersistedTask): Partial<StateContext> {
    return {
      state: task.state,
      taskId: task.id,
      task: task.description,
      plan: task.plan,
      currentStepIndex: task.currentStepIndex,
      results: task.results,
      error: task.error ? this.deserializeError(task.error) : null,
      startTime: task.createdAt,
      metadata: task.context
    };
  }

  private stateToStatus(state: AgentState): TaskStatus {
    const mapping: Record<AgentState, TaskStatus> = {
      [AgentState.IDLE]: 'pending',
      [AgentState.PLANNING]: 'planning',
      [AgentState.EXECUTING]: 'executing',
      [AgentState.WAITING]: 'waiting',
      [AgentState.COMPLETE]: 'completed',
      [AgentState.ERROR]: 'failed'
    };
    return mapping[state] || 'pending';
  }

  // -------------------- Execution History --------------------

  async recordExecution(record: ExecutionRecord): Promise<void> {
    const key = this.getKey(this.KEYS.HISTORY, `${record.taskId}:${record.id}`);
    await this.adapter.set(key, record, this.config.historyRetention);
  }

  async getTaskHistory(taskId: string): Promise<TaskHistory> {
    const pattern = this.getKey(this.KEYS.HISTORY, `${taskId}:*`);
    const keys = await this.adapter.keys(pattern);
    
    const recordsMap = await this.adapter.getMany<ExecutionRecord>(keys);
    const records = Array.from(recordsMap.values())
      .sort((a, b) => a.startTime - b.startTime);

    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
    const successCount = records.filter(r => r.status === 'success').length;
    const failureCount = records.filter(r => r.status === 'failed').length;

    return {
      taskId,
      records,
      totalDuration,
      successCount,
      failureCount
    };
  }

  async queryHistory(options: HistoryQueryOptions = {}): Promise<ExecutionRecord[]> {
    let pattern: string;
    
    if (options.taskId) {
      pattern = this.getKey(this.KEYS.HISTORY, `${options.taskId}:*`);
    } else {
      pattern = this.getKey(this.KEYS.HISTORY, '*');
    }

    const keys = await this.adapter.keys(pattern);
    const recordsMap = await this.adapter.getMany<ExecutionRecord>(keys);
    let records = Array.from(recordsMap.values());

    // Apply filters
    if (options.stepId) {
      records = records.filter(r => r.stepId === options.stepId);
    }

    if (options.status) {
      records = records.filter(r => r.status === options.status);
    }

    if (options.fromDate) {
      records = records.filter(r => r.startTime >= options.fromDate!);
    }

    if (options.toDate) {
      records = records.filter(r => r.startTime <= options.toDate!);
    }

    // Sort by time descending
    records.sort((a, b) => b.startTime - a.startTime);

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return records.slice(offset, offset + limit);
  }

  async deleteTaskHistory(taskId: string): Promise<void> {
    const pattern = this.getKey(this.KEYS.HISTORY, `${taskId}:*`);
    const keys = await this.adapter.keys(pattern);
    await this.adapter.deleteMany(keys);
  }

  // -------------------- Checkpoints --------------------

  async createCheckpoint(
    taskId: string,
    context: StateContext,
    results: StepResult[]
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: generateId('ckpt'),
      taskId,
      timestamp: Date.now(),
      state: context.state,
      stepIndex: context.currentStepIndex,
      context: { ...context.metadata },
      results: [...results],
      canResume: context.state === AgentState.EXECUTING || 
                 context.state === AgentState.WAITING,
      expiresAt: Date.now() + this.config.checkpointRetention!
    };

    const key = this.getKey(this.KEYS.CHECKPOINT, `${taskId}:${checkpoint.id}`);
    await this.adapter.set(key, checkpoint, this.config.checkpointRetention);

    this.emitEvent('checkpoint', taskId, true);
    return checkpoint;
  }

  async getLatestCheckpoint(taskId: string): Promise<Checkpoint | null> {
    const checkpoints = await this.getTaskCheckpoints(taskId);
    
    if (checkpoints.length === 0) return null;
    
    // Return most recent that can be resumed
    const resumable = checkpoints.filter(c => c.canResume);
    return resumable[0] || checkpoints[0];
  }

  async getTaskCheckpoints(taskId: string): Promise<Checkpoint[]> {
    const pattern = this.getKey(this.KEYS.CHECKPOINT, `${taskId}:*`);
    const keys = await this.adapter.keys(pattern);
    
    const checkpointsMap = await this.adapter.getMany<Checkpoint>(keys);
    const checkpoints = Array.from(checkpointsMap.values())
      .filter(c => !c.expiresAt || c.expiresAt > Date.now())
      .sort((a, b) => b.timestamp - a.timestamp);

    return checkpoints;
  }

  async deleteTaskCheckpoints(taskId: string): Promise<void> {
    const pattern = this.getKey(this.KEYS.CHECKPOINT, `${taskId}:*`);
    const keys = await this.adapter.keys(pattern);
    await this.adapter.deleteMany(keys);
  }

  // -------------------- Plan Versioning --------------------

  async savePlanVersion(
    taskId: string,
    plan: ExecutionPlan,
    reason: 'initial' | 'replan' | 'modification',
    parentVersionId?: string
  ): Promise<PlanVersion> {
    // Get current version count
    const versions = await this.getPlanVersions(taskId);
    const version = versions.length + 1;

    const planVersion: PlanVersion = {
      id: generateId('planv'),
      taskId,
      version,
      plan,
      reason,
      createdAt: Date.now(),
      parentVersionId: parentVersionId || null
    };

    const key = this.getKey(this.KEYS.PLAN_VERSION, `${taskId}:${planVersion.id}`);
    await this.adapter.set(key, planVersion);

    return planVersion;
  }

  async getPlanVersions(taskId: string): Promise<PlanVersion[]> {
    const pattern = this.getKey(this.KEYS.PLAN_VERSION, `${taskId}:*`);
    const keys = await this.adapter.keys(pattern);
    
    const versionsMap = await this.adapter.getMany<PlanVersion>(keys);
    const versions = Array.from(versionsMap.values())
      .sort((a, b) => a.version - b.version);

    return versions;
  }

  async getLatestPlanVersion(taskId: string): Promise<PlanVersion | null> {
    const versions = await this.getPlanVersions(taskId);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  async deleteTaskPlanVersions(taskId: string): Promise<void> {
    const pattern = this.getKey(this.KEYS.PLAN_VERSION, `${taskId}:*`);
    const keys = await this.adapter.keys(pattern);
    await this.adapter.deleteMany(keys);
  }

  // -------------------- Task Resume --------------------

  async canResumeTask(taskId: string): Promise<{
    canResume: boolean;
    checkpoint: Checkpoint | null;
    reason?: string;
  }> {
    const task = await this.loadTask(taskId);
    
    if (!task) {
      return { canResume: false, checkpoint: null, reason: 'Task not found' };
    }

    if (task.status === 'completed') {
      return { canResume: false, checkpoint: null, reason: 'Task already completed' };
    }

    if (task.status === 'cancelled') {
      return { canResume: false, checkpoint: null, reason: 'Task was cancelled' };
    }

    const checkpoint = await this.getLatestCheckpoint(taskId);
    
    if (!checkpoint) {
      return { canResume: false, checkpoint: null, reason: 'No checkpoint available' };
    }

    if (!checkpoint.canResume) {
      return { canResume: false, checkpoint, reason: 'Checkpoint not resumable' };
    }

    return { canResume: true, checkpoint };
  }

  async getResumeData(taskId: string): Promise<{
    task: PersistedTask;
    checkpoint: Checkpoint;
    remainingSteps: number;
  } | null> {
    const { canResume, checkpoint } = await this.canResumeTask(taskId);
    
    if (!canResume || !checkpoint) {
      return null;
    }

    const task = await this.loadTask(taskId);
    if (!task || !task.plan) {
      return null;
    }

    const remainingSteps = task.plan.steps.length - checkpoint.stepIndex - 1;

    return {
      task,
      checkpoint,
      remainingSteps
    };
  }

  // -------------------- Cleanup --------------------

  async cleanup(): Promise<{
    expiredCheckpoints: number;
    expiredHistory: number;
  }> {
    let expiredCheckpoints = 0;
    let expiredHistory = 0;

    // Clean expired checkpoints
    const checkpointPattern = this.getKey(this.KEYS.CHECKPOINT, '*');
    const checkpointKeys = await this.adapter.keys(checkpointPattern);
    
    for (const key of checkpointKeys) {
      const checkpoint = await this.adapter.get<Checkpoint>(key);
      if (checkpoint && checkpoint.expiresAt && checkpoint.expiresAt < Date.now()) {
        await this.adapter.delete(key);
        expiredCheckpoints++;
      }
    }

    // Clean old history (based on retention setting)
    const cutoff = Date.now() - this.config.historyRetention!;
    const historyPattern = this.getKey(this.KEYS.HISTORY, '*');
    const historyKeys = await this.adapter.keys(historyPattern);

    for (const key of historyKeys) {
      const record = await this.adapter.get<ExecutionRecord>(key);
      if (record && record.startTime < cutoff) {
        await this.adapter.delete(key);
        expiredHistory++;
      }
    }

    return { expiredCheckpoints, expiredHistory };
  }

  // -------------------- Auto Save --------------------

  private startAutoSave(): void {
    if (this.autoSaveInterval) return;

    this.autoSaveInterval = setInterval(async () => {
      await this.flush();
    }, this.config.checkpointInterval);
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  async flush(): Promise<void> {
    if (this.pendingChanges.size === 0) return;

    const entries = new Map<string, PersistedTask>();
    
    for (const [taskId, task] of this.pendingChanges) {
      entries.set(this.getKey(this.KEYS.TASK, taskId), task);
    }

    await this.adapter.setMany(entries);
    this.pendingChanges.clear();
  }

  // -------------------- Index Management --------------------

  private async updateTaskIndex(task: PersistedTask): Promise<void> {
    const indexKey = this.getKey(this.KEYS.INDEX, 'tasks');
    const index = await this.adapter.get<string[]>(indexKey) || [];
    
    if (!index.includes(task.id)) {
      index.push(task.id);
      await this.adapter.set(indexKey, index);
    }
  }

  private async removeFromTaskIndex(taskId: string): Promise<void> {
    const indexKey = this.getKey(this.KEYS.INDEX, 'tasks');
    const index = await this.adapter.get<string[]>(indexKey) || [];
    
    const newIndex = index.filter(id => id !== taskId);
    await this.adapter.set(indexKey, newIndex);
  }

  // -------------------- Utility Methods --------------------

  private getKey(prefix: string, suffix: string): string {
    return `${this.keyPrefix}${prefix}${suffix}`;
  }

  private serializeError(error: Error): SerializedError {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  private deserializeError(serialized: SerializedError): Error {
    const error = new Error(serialized.message);
    error.name = serialized.name;
    error.stack = serialized.stack;
    return error;
  }

  private emitEvent(
    type: PersistenceEvent['type'],
    taskId: string,
    success: boolean,
    error?: Error
  ): void {
    const event: PersistenceEvent = {
      type,
      taskId,
      timestamp: Date.now(),
      success,
      error
    };
    this.emit('persistence', event);
    this.emit(`persistence:${type}`, event);
  }

  // -------------------- Statistics --------------------

  async getStatistics(): Promise<{
    totalTasks: number;
    tasksByStatus: Record<TaskStatus, number>;
    totalCheckpoints: number;
    totalHistoryRecords: number;
    storageSize: number;
  }> {
    const tasks = await this.queryTasks({ limit: 10000 });
    
    const tasksByStatus: Record<TaskStatus, number> = {
      pending: 0,
      planning: 0,
      executing: 0,
      paused: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const task of tasks) {
      tasksByStatus[task.status]++;
    }

    const checkpointKeys = await this.adapter.keys(this.getKey(this.KEYS.CHECKPOINT, '*'));
    const historyKeys = await this.adapter.keys(this.getKey(this.KEYS.HISTORY, '*'));

    return {
      totalTasks: tasks.length,
      tasksByStatus,
      totalCheckpoints: checkpointKeys.length,
      totalHistoryRecords: historyKeys.length,
      storageSize: 0 // Would need adapter-specific implementation
    };
  }
}
