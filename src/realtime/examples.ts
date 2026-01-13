// ============================================
// Agent Core - Realtime Examples
// ============================================

import {
  // Server
  RealtimeServer,
  SSEServer,
  // Client
  WebSocketClient,
  createWebSocketClient,
  SSEClient,
  createSSEClient,
  // Agent
  createRealtimeAgent,
  createWebSocketAgent,
  // Tools
  defaultTools,
  // Types
  LLMClient,
  LLMMessage,
  RealtimeMessage,
  MemoryStorageAdapter
} from '../index';

// ============================================
// Example 1: WebSocket Server Setup
// ============================================

async function webSocketServerExample() {
  // Create WebSocket server
  const wsServer = new RealtimeServer({
    port: 8080,
    path: '/ws',
    heartbeatInterval: 30000,
    maxConnections: 100
  });

  // Listen to server events
  wsServer.on('server:started', ({ port, path }) => {
    console.log(`WebSocket server started on ws://localhost:${port}${path}`);
  });

  wsServer.on('client:connected', ({ clientId, info }) => {
    console.log(`Client connected: ${clientId}`);
  });

  wsServer.on('client:disconnected', ({ clientId }) => {
    console.log(`Client disconnected: ${clientId}`);
  });

  wsServer.on('command', ({ clientId, payload }) => {
    console.log(`Command from ${clientId}:`, payload);
  });

  // Start server
  await wsServer.start();

  // Create agent with realtime support
  const agent = createWebSocketAgent(
    {
      llm: createMockLLM(),
      plannerConfig: defaultPlannerConfig(),
      executorConfig: defaultExecutorConfig(),
      tools: defaultTools
    },
    wsServer
  );

  // Process task - events will be broadcast to connected clients
  await agent.process('Analyze document');

  // Stop server when done
  // await wsServer.stop();
}

// ============================================
// Example 2: WebSocket Client (Browser/Node)
// ============================================

async function webSocketClientExample() {
  // Create client
  const client = createWebSocketClient('ws://localhost:8080/ws', {
    reconnect: true,
    reconnectInterval: 3000,
    reconnectAttempts: 10
  });

  // Connection events
  client.onConnect(() => {
    console.log('Connected to server');
  });

  client.onDisconnect((reason) => {
    console.log('Disconnected:', reason);
  });

  client.onError((error) => {
    console.error('Error:', error);
  });

  // Task events
  client.onTaskStart((payload) => {
    console.log('Task started:', payload.taskId);
  });

  client.onPlanCreated((payload) => {
    console.log(`Plan created with ${payload.plan.steps.length} steps`);
  });

  client.onStepStart((payload) => {
    console.log(`Step ${payload.stepIndex + 1}/${payload.totalSteps}: ${payload.stepName}`);
  });

  client.onStepProgress((payload) => {
    console.log(`Progress: ${payload.progress}% - ${payload.message}`);
  });

  client.onStepComplete((payload) => {
    const icon = payload.status === 'success' ? '✓' : '✗';
    console.log(`${icon} ${payload.stepName} (${payload.duration}ms)`);
  });

  client.onTaskComplete((payload) => {
    console.log(`Task ${payload.success ? 'completed' : 'failed'} in ${payload.duration}ms`);
  });

  client.onWaitingConfirmation((payload) => {
    console.log(`Waiting for confirmation: ${payload.description}`);
    // Auto confirm after 2 seconds
    setTimeout(() => {
      client.confirm(payload.taskId, { approved: true });
    }, 2000);
  });

  client.onStateChange((payload) => {
    console.log(`State: ${payload.previousState} -> ${payload.currentState}`);
  });

  // Connect
  await client.connect();

  // Subscribe to specific task
  // client.subscribe('task_123');

  // Send commands
  // client.confirm('task_123');
  // client.cancel('task_123');
  // client.pause('task_123');
  // client.resume('task_123');
}

// ============================================
// Example 3: SSE Server Setup (with Express)
// ============================================

async function sseServerExample() {
  // This would be used with Express
  /*
  import express from 'express';
  
  const app = express();
  const sseServer = new SSEServer({
    heartbeatInterval: 30000,
    retry: 3000
  });

  // SSE endpoint
  app.get('/events', (req, res) => {
    const clientId = sseServer.handleConnection(req, res);
    
    // Optionally subscribe to specific task from query param
    const taskId = req.query.taskId as string;
    if (taskId) {
      sseServer.subscribeToTask(clientId, taskId);
    }
  });

  // Command endpoint (SSE is one-way, so commands go via HTTP)
  app.post('/command', express.json(), (req, res) => {
    agent.handleHttpCommand(req.body, res);
  });

  app.listen(3000);
  */

  // Create SSE server
  const sseServer = new SSEServer({
    heartbeatInterval: 30000,
    retry: 3000
  });

  // Listen to events
  sseServer.on('client:connected', ({ clientId }) => {
    console.log(`SSE client connected: ${clientId}`);
  });

  sseServer.on('client:disconnected', ({ clientId }) => {
    console.log(`SSE client disconnected: ${clientId}`);
  });

  console.log('SSE server ready (use with Express app.get("/events", handler))');
}

// ============================================
// Example 4: SSE Client (Browser)
// ============================================

async function sseClientExample() {
  // Create client
  const client = createSSEClient('http://localhost:3000/events?taskId=task_123', {
    withCredentials: false,
    reconnect: true
  });

  // Same event handlers as WebSocket
  client.onConnect(() => {
    console.log('Connected to SSE server');
  });

  client.onTaskStart((payload) => {
    console.log('Task started:', payload.taskId);
  });

  client.onStepComplete((payload) => {
    console.log(`Step completed: ${payload.stepName}`);
  });

  client.onTaskComplete((payload) => {
    console.log('Task completed:', payload.success);
  });

  client.onWaitingConfirmation(async (payload) => {
    console.log('Waiting for confirmation:', payload.description);
    // SSE requires HTTP for commands
    await client.confirm('http://localhost:3000/command', payload.taskId);
  });

  // Connect
  await client.connect();

  // Commands via HTTP (SSE is one-way)
  // await client.confirm('http://localhost:3000/command', 'task_123');
  // await client.cancel('http://localhost:3000/command', 'task_123');
}

// ============================================
// Example 5: Full Stack Integration
// ============================================

async function fullStackExample() {
  // --- Server Side ---
  
  // Create WebSocket server
  const wsServer = new RealtimeServer({ port: 8080 });
  await wsServer.start();

  // Create agent with persistence and realtime
  const agent = createRealtimeAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    realtime: {
      type: 'websocket',
      server: wsServer
    },
    persistence: {
      adapter: new MemoryStorageAdapter()
    }
  });

  // Initialize persistence
  if ('initialize' in agent) {
    await (agent as any).initialize();
  }

  // --- Client Side (Browser) ---
  
  const client = createWebSocketClient('ws://localhost:8080/ws');
  
  // UI state
  const uiState = {
    taskId: null as string | null,
    plan: null as any,
    currentStep: 0,
    steps: [] as any[],
    status: 'idle' as string
  };

  // Update UI on events
  client.onTaskStart((payload) => {
    uiState.taskId = payload.taskId;
    uiState.status = 'running';
    updateUI();
  });

  client.onPlanCreated((payload) => {
    uiState.plan = payload.plan;
    uiState.steps = payload.plan.steps.map((s: any) => ({
      ...s,
      status: 'pending'
    }));
    updateUI();
  });

  client.onStepStart((payload) => {
    uiState.currentStep = payload.stepIndex;
    uiState.steps[payload.stepIndex].status = 'running';
    updateUI();
  });

  client.onStepComplete((payload) => {
    const step = uiState.steps.find(s => s.id === payload.stepId);
    if (step) {
      step.status = payload.status;
      step.duration = payload.duration;
    }
    updateUI();
  });

  client.onTaskComplete((payload) => {
    uiState.status = payload.success ? 'completed' : 'failed';
    updateUI();
  });

  client.onWaitingConfirmation((payload) => {
    uiState.status = 'waiting';
    // Show confirmation dialog
    showConfirmDialog(payload.description, (confirmed: boolean) => {
      if (confirmed) {
        client.confirm(payload.taskId);
      } else {
        client.reject(payload.taskId);
      }
    });
  });

  await client.connect();

  // Start task (via HTTP API in real app)
  await agent.process('Analyze uploaded files');

  // Helper functions
  function updateUI() {
    console.log('UI State:', JSON.stringify(uiState, null, 2));
    // In real app: React setState, Vue reactive update, etc.
  }

  function showConfirmDialog(message: string, callback: (confirmed: boolean) => void) {
    console.log(`Confirm dialog: ${message}`);
    // Auto confirm for demo
    setTimeout(() => callback(true), 1000);
  }
}

// ============================================
// Example 6: React Hook Usage
// ============================================

/*
// useAgentRealtime.ts

import { useState, useEffect, useCallback } from 'react';
import { WebSocketClient, createWebSocketClient, RealtimeMessage } from '@agent-core';

interface AgentState {
  connected: boolean;
  taskId: string | null;
  status: 'idle' | 'planning' | 'executing' | 'waiting' | 'completed' | 'failed';
  plan: any | null;
  currentStep: number;
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    duration?: number;
  }>;
  error: string | null;
}

export function useAgentRealtime(url: string) {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [state, setState] = useState<AgentState>({
    connected: false,
    taskId: null,
    status: 'idle',
    plan: null,
    currentStep: 0,
    steps: [],
    error: null
  });

  useEffect(() => {
    const wsClient = createWebSocketClient(url);

    wsClient.onConnect(() => {
      setState(prev => ({ ...prev, connected: true }));
    });

    wsClient.onDisconnect(() => {
      setState(prev => ({ ...prev, connected: false }));
    });

    wsClient.onTaskStart((payload) => {
      setState(prev => ({
        ...prev,
        taskId: payload.taskId,
        status: 'planning',
        error: null
      }));
    });

    wsClient.onPlanCreated((payload) => {
      setState(prev => ({
        ...prev,
        plan: payload.plan,
        steps: payload.plan.steps.map((s: any) => ({
          id: s.id,
          name: s.name,
          status: 'pending'
        })),
        status: 'executing'
      }));
    });

    wsClient.onStepStart((payload) => {
      setState(prev => {
        const steps = [...prev.steps];
        steps[payload.stepIndex].status = 'running';
        return { ...prev, currentStep: payload.stepIndex, steps };
      });
    });

    wsClient.onStepComplete((payload) => {
      setState(prev => {
        const steps = prev.steps.map(s =>
          s.id === payload.stepId
            ? { ...s, status: payload.status, duration: payload.duration }
            : s
        );
        return { ...prev, steps };
      });
    });

    wsClient.onTaskComplete((payload) => {
      setState(prev => ({
        ...prev,
        status: payload.success ? 'completed' : 'failed'
      }));
    });

    wsClient.onTaskError((payload) => {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: payload.error.message
      }));
    });

    wsClient.onWaitingConfirmation(() => {
      setState(prev => ({ ...prev, status: 'waiting' }));
    });

    wsClient.connect();
    setClient(wsClient);

    return () => {
      wsClient.disconnect();
    };
  }, [url]);

  const confirm = useCallback((data?: any) => {
    if (client && state.taskId) {
      client.confirm(state.taskId, data);
    }
  }, [client, state.taskId]);

  const reject = useCallback((reason?: string) => {
    if (client && state.taskId) {
      client.reject(state.taskId, reason);
    }
  }, [client, state.taskId]);

  const cancel = useCallback(() => {
    if (client && state.taskId) {
      client.cancel(state.taskId);
    }
  }, [client, state.taskId]);

  return {
    state,
    confirm,
    reject,
    cancel
  };
}

// Usage in component:
function TaskProgress() {
  const { state, confirm, reject, cancel } = useAgentRealtime('ws://localhost:8080/ws');

  if (!state.connected) {
    return <div>Connecting...</div>;
  }

  return (
    <div>
      <h2>Status: {state.status}</h2>
      
      {state.steps.map((step, index) => (
        <div key={step.id} className={step.status}>
          {index + 1}. {step.name} - {step.status}
          {step.duration && <span> ({step.duration}ms)</span>}
        </div>
      ))}
      
      {state.status === 'waiting' && (
        <div>
          <button onClick={() => confirm()}>Confirm</button>
          <button onClick={() => reject()}>Reject</button>
        </div>
      )}
      
      {state.status === 'executing' && (
        <button onClick={cancel}>Cancel</button>
      )}
      
      {state.error && <div className="error">{state.error}</div>}
    </div>
  );
}
*/

// ============================================
// Helper Functions
// ============================================

function createMockLLM(): LLMClient {
  return {
    async complete(prompt: string) {
      return JSON.stringify([
        { id: 'step_1', type: 'llm', name: 'Analyze', params: {} },
        { id: 'step_2', type: 'llm', name: 'Process', params: {}, dependsOn: ['step_1'] },
        { id: 'step_3', type: 'llm', name: 'Generate', params: {}, dependsOn: ['step_2'] }
      ]);
    },
    async chat(messages: LLMMessage[]) {
      return 'Response';
    }
  };
}

function defaultPlannerConfig() {
  return {
    model: 'gpt-4',
    maxSteps: 20,
    enableParallel: true,
    confidenceThreshold: 0.8,
    planningTimeout: 60000
  };
}

function defaultExecutorConfig() {
  return {
    maxConcurrency: 3,
    defaultTimeout: 30000,
    retryDelay: 1000,
    maxRetries: 3
  };
}

// ============================================
// Run Examples
// ============================================

// Uncomment to run:
// webSocketServerExample();
// webSocketClientExample();
// sseServerExample();
// sseClientExample();
// fullStackExample();

export {
  webSocketServerExample,
  webSocketClientExample,
  sseServerExample,
  sseClientExample,
  fullStackExample
};
