// ============================================
// Agent Core UI - WebSocket Hook
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  AgentState, 
  ExecutionPlan, 
  ExecutionStep,
  TaskResult, 
  LogEntry, 
  WSMessage,
  ToolDefinition 
} from '../types';

export interface UseAgentOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface UseAgentReturn {
  // State
  connected: boolean;
  state: AgentState;
  plan: ExecutionPlan | null;
  currentStepId: string | null;
  result: TaskResult | null;
  logs: LogEntry[];
  tools: ToolDefinition[];
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  submitTask: (task: string, context?: Record<string, unknown>) => void;
  cancelTask: () => void;
  confirmStep: (stepId: string, approved: boolean) => void;
  clearLogs: () => void;
}

let logIdCounter = 0;

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const {
    wsUrl = 'ws://localhost:8080/ws',
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 3000,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // State
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<AgentState>('idle');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  // Add log entry
  const addLog = useCallback((
    level: LogEntry['level'], 
    message: string, 
    data?: unknown
  ) => {
    const entry: LogEntry = {
      id: `log_${++logIdCounter}`,
      timestamp: Date.now(),
      level,
      message,
      data,
    };
    setLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      
      switch (msg.type) {
        case 'connected':
          addLog('info', 'Connected to agent server');
          break;

        case 'status': {
          const { state: newState, message } = msg.data as { state: string; message: string };
          setState(newState as AgentState);
          addLog('info', message);
          break;
        }

        case 'plan:created': {
          const { plan: newPlan } = msg.data as { plan: ExecutionPlan };
          setPlan(newPlan);
          setResult(null);
          addLog('info', `Plan created: ${newPlan.steps.length} steps`);
          break;
        }

        case 'plan:updated': {
          const { plan: updatedPlan } = msg.data as { plan: ExecutionPlan };
          setPlan(updatedPlan);
          addLog('info', 'Plan updated');
          break;
        }

        case 'step:start': {
          const { stepId, stepName } = msg.data as { stepId: string; stepName: string };
          setCurrentStepId(stepId);
          updateStepStatus(stepId, 'running');
          addLog('info', `Starting: ${stepName}`);
          break;
        }

        case 'step:progress': {
          const { stepId, progress, message } = msg.data as { 
            stepId: string; 
            progress: number; 
            message: string 
          };
          addLog('debug', `[${stepId}] ${progress}% - ${message}`);
          break;
        }

        case 'step:complete': {
          const { stepId, stepName, result: stepResult } = msg.data as { 
            stepId: string; 
            stepName: string;
            result: { status: string; output?: unknown; duration: number } 
          };
          updateStepStatus(stepId, stepResult.status as ExecutionStep['status']);
          updateStepResult(stepId, stepResult);
          addLog('info', `✓ Completed: ${stepName} (${stepResult.duration}ms)`);
          break;
        }

        case 'step:error': {
          const { stepId, stepName, error } = msg.data as { 
            stepId: string; 
            stepName: string;
            error: string 
          };
          updateStepStatus(stepId, 'failed');
          addLog('error', `✗ Failed: ${stepName} - ${error}`);
          break;
        }

        case 'task:complete': {
          const taskResult = msg.data as TaskResult;
          setResult(taskResult);
          setState('complete');
          setCurrentStepId(null);
          addLog('info', `Task completed: ${taskResult.success ? 'Success' : 'Failed'}`);
          break;
        }

        case 'task:error': {
          const { error } = msg.data as { error: string };
          setState('error');
          addLog('error', `Task error: ${error}`);
          break;
        }

        case 'waiting:confirmation': {
          const { stepId, stepName, reason } = msg.data as { 
            stepId: string; 
            stepName: string;
            reason: string 
          };
          setState('waiting');
          addLog('warn', `Waiting for confirmation: ${stepName} - ${reason}`);
          break;
        }

        case 'tools:list': {
          const { tools: toolList } = msg.data as { tools: ToolDefinition[] };
          setTools(toolList);
          break;
        }

        case 'error': {
          const { message } = msg.data as { message: string };
          addLog('error', message);
          break;
        }
      }
    } catch (error) {
      addLog('error', `Failed to parse message: ${error}`);
    }
  }, [addLog]);

  // Update step status in plan
  const updateStepStatus = useCallback((stepId: string, status: ExecutionStep['status']) => {
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map(step => 
          step.id === stepId ? { ...step, status } : step
        ),
      };
    });
  }, []);

  // Update step result in plan
  const updateStepResult = useCallback((stepId: string, result: { output?: unknown; duration: number }) => {
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map(step => 
          step.id === stepId ? { ...step, ...result } : step
        ),
      };
    });
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        addLog('info', 'WebSocket connected');
        onConnect?.();
        
        // Request tools list
        ws.send(JSON.stringify({ type: 'get:tools' }));
      };

      ws.onclose = () => {
        setConnected(false);
        addLog('info', 'WebSocket disconnected');
        onDisconnect?.();

        // Reconnect
        if (reconnect) {
          reconnectTimerRef.current = window.setTimeout(() => {
            addLog('info', 'Attempting to reconnect...');
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = () => {
        const error = new Error('WebSocket error');
        addLog('error', 'WebSocket error');
        onError?.(error);
      };

      ws.onmessage = handleMessage;

    } catch (error) {
      addLog('error', `Failed to connect: ${error}`);
      onError?.(error as Error);
    }
  }, [wsUrl, reconnect, reconnectInterval, handleMessage, addLog, onConnect, onDisconnect, onError]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // Submit task
  const submitTask = useCallback((task: string, context?: Record<string, unknown>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('error', 'Not connected to server');
      return;
    }

    // Reset state
    setPlan(null);
    setResult(null);
    setCurrentStepId(null);
    setState('planning');

    wsRef.current.send(JSON.stringify({
      type: 'task:submit',
      data: { task, context },
    }));

    addLog('info', `Task submitted: ${task}`);
  }, [addLog]);

  // Cancel task
  const cancelTask = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ type: 'task:cancel' }));
    addLog('warn', 'Task cancelled');
  }, [addLog]);

  // Confirm step
  const confirmStep = useCallback((stepId: string, approved: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'step:confirm',
      data: { stepId, approved },
    }));

    addLog('info', `Step ${stepId}: ${approved ? 'Approved' : 'Rejected'}`);
  }, [addLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Auto connect
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    state,
    plan,
    currentStepId,
    result,
    logs,
    tools,
    connect,
    disconnect,
    submitTask,
    cancelTask,
    confirmStep,
    clearLogs,
  };
}
