// ============================================
// Agent Core - Realtime Agent
// ============================================

import { AgentConfig, AgentResponse, AgentState } from '../types';
import { Agent } from '../core/Agent';
import { PersistentAgent, PersistentAgentConfig } from '../persistence/PersistentAgent';
import { RealtimeServer } from './WebSocketServer';
import { SSEServer } from './SSEServer';
import { CommandPayload } from './types';

export interface RealtimeAgentConfig extends Partial<PersistentAgentConfig> {
  llm: AgentConfig['llm'];
  plannerConfig: AgentConfig['plannerConfig'];
  executorConfig: AgentConfig['executorConfig'];
  tools?: AgentConfig['tools'];
  realtime: {
    type: 'websocket' | 'sse';
    server: RealtimeServer | SSEServer;
  };
  persistence?: PersistentAgentConfig['persistence'];
}

export class RealtimeAgent extends (PersistentAgent || Agent) {
  private realtimeServer: RealtimeServer | SSEServer;
  private realtimeType: 'websocket' | 'sse';

  constructor(config: RealtimeAgentConfig) {
    // Call parent constructor
    const baseConfig = {
      llm: config.llm,
      plannerConfig: config.plannerConfig,
      executorConfig: config.executorConfig,
      tools: config.tools,
      ...(config.persistence && { persistence: config.persistence })
    };

    super(baseConfig as any);

    this.realtimeServer = config.realtime.server;
    this.realtimeType = config.realtime.type;

    this.setupRealtimeHooks();
    this.setupCommandHandling();
  }

  // -------------------- Realtime Hooks --------------------

  private setupRealtimeHooks(): void {
    // Task events
    this.on('status', (data: any) => {
      if (data.state === 'planning') {
        const context = this.getContext();
        this.realtimeServer.broadcastTaskStart(
          context.taskId,
          context.task,
          context.metadata
        );
      }
    });

    // Plan events
    this.on('plan:created', ({ plan }: any) => {
      const context = this.getContext();
      this.realtimeServer.broadcastPlanCreated(context.taskId, plan);
    });

    // Step events
    this.on('step:start', ({ stepId, stepName, type }: any) => {
      const context = this.getContext();
      const plan = context.plan;
      if (plan) {
        const index = plan.steps.findIndex(s => s.id === stepId);
        const step = plan.steps[index];
        this.realtimeServer.broadcastStepStart(
          context.taskId,
          step,
          index,
          plan.steps.length
        );
      }
    });

    this.on('step:complete', ({ result }: any) => {
      const context = this.getContext();
      this.realtimeServer.broadcastStepComplete(context.taskId, result);
    });

    this.on('step:error', ({ result, error }: any) => {
      const context = this.getContext();
      this.realtimeServer.broadcastStepComplete(context.taskId, result);
    });

    // State change events
    this.on('transition', ({ from, to, trigger }: any) => {
      const context = this.getContext();
      this.realtimeServer.broadcastStateChange(
        context.taskId,
        from,
        to,
        trigger
      );
    });

    // Task completion events
    this.on('task:complete', ({ success }: any) => {
      const context = this.getContext();
      const duration = Date.now() - context.startTime;
      this.realtimeServer.broadcastTaskComplete(
        context.taskId,
        true,
        duration,
        `Task completed successfully`
      );
    });

    this.on('task:error', ({ error }: any) => {
      const context = this.getContext();
      this.realtimeServer.broadcastTaskError(context.taskId, error);
    });

    // Waiting for confirmation
    this.on('waiting:confirmation', ({ stepId, stepName, description }: any) => {
      const context = this.getContext();
      this.realtimeServer.broadcastWaitingConfirmation(
        context.taskId,
        stepId,
        stepName,
        description
      );
    });

    // Checkpoint events (if persistence enabled)
    this.on('checkpoint:created', ({ checkpoint }: any) => {
      if (this.realtimeServer instanceof RealtimeServer) {
        this.realtimeServer.broadcastToTask(checkpoint.taskId, {
          id: `msg_${Date.now()}`,
          type: 'checkpoint:created',
          taskId: checkpoint.taskId,
          timestamp: Date.now(),
          payload: {
            taskId: checkpoint.taskId,
            checkpointId: checkpoint.id,
            stepIndex: checkpoint.stepIndex,
            canResume: checkpoint.canResume
          }
        });
      }
    });
  }

  // -------------------- Command Handling --------------------

  private setupCommandHandling(): void {
    if (this.realtimeServer instanceof RealtimeServer) {
      this.realtimeServer.on('command', ({ clientId, payload }: { clientId: string; payload: CommandPayload }) => {
        this.handleCommand(payload);
      });
    }
  }

  private handleCommand(payload: CommandPayload): void {
    const { command, taskId, data } = payload;

    switch (command) {
      case 'confirm':
        this.confirm(data);
        break;

      case 'reject':
        this.reject(data?.reason);
        break;

      case 'cancel':
        this.cancel();
        break;

      case 'pause':
        this.pause();
        break;

      case 'resume':
        this.resume();
        break;

      default:
        console.warn(`Unknown command: ${command}`);
    }
  }

  // -------------------- HTTP Command Handler (for SSE) --------------------

  /**
   * Handle HTTP command requests (for SSE which is one-way)
   * Use in Express: app.post('/command', (req, res) => agent.handleHttpCommand(req.body, res))
   */
  handleHttpCommand(body: any, res?: any): { success: boolean; error?: string } {
    try {
      const { command, taskId, data } = body as CommandPayload;
      
      this.handleCommand({ command, taskId, data });
      
      const result = { success: true };
      if (res) {
        res.json(result);
      }
      return result;

    } catch (error) {
      const result = { success: false, error: (error as Error).message };
      if (res) {
        res.status(400).json(result);
      }
      return result;
    }
  }

  // -------------------- Progress Reporting --------------------

  /**
   * Report progress for current step
   */
  reportProgress(progress: number, message?: string): void {
    const context = this.getContext();
    const currentStep = context.plan?.steps[context.currentStepIndex];
    
    if (currentStep) {
      this.realtimeServer.broadcastStepProgress(
        context.taskId,
        currentStep.id,
        progress,
        message
      );
    }
  }

  // -------------------- Getters --------------------

  getRealtimeServer(): RealtimeServer | SSEServer {
    return this.realtimeServer;
  }

  getRealtimeType(): 'websocket' | 'sse' {
    return this.realtimeType;
  }

  getConnectedClients(): number {
    return this.realtimeServer.getConnectionCount();
  }
}

// -------------------- Factory Functions --------------------

export function createRealtimeAgent(config: RealtimeAgentConfig): RealtimeAgent {
  return new RealtimeAgent(config);
}

export function createWebSocketAgent(
  config: Omit<RealtimeAgentConfig, 'realtime'>,
  wsServer: RealtimeServer
): RealtimeAgent {
  return new RealtimeAgent({
    ...config,
    realtime: {
      type: 'websocket',
      server: wsServer
    }
  });
}

export function createSSEAgent(
  config: Omit<RealtimeAgentConfig, 'realtime'>,
  sseServer: SSEServer
): RealtimeAgent {
  return new RealtimeAgent({
    ...config,
    realtime: {
      type: 'sse',
      server: sseServer
    }
  });
}
