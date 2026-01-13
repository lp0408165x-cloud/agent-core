// ============================================
// Agent Core UI - Agent Panel Component
// ============================================

import React, { useEffect } from 'react';
import { useAgent } from '../hooks/useAgent';
import { TaskInput } from './TaskInput';
import { PlanView } from './PlanView';
import { LogPanel } from './LogPanel';
import { ResultView } from './ResultView';
import type { AgentPanelProps, AgentState } from '../types';
import '../styles/index.css';

const stateLabels: Record<AgentState, string> = {
  idle: '空闲',
  planning: '规划中',
  executing: '执行中',
  waiting: '等待确认',
  complete: '已完成',
  error: '错误',
};

export const AgentPanel: React.FC<AgentPanelProps> = ({
  wsUrl,
  apiUrl,
  onTaskComplete,
  onError,
  className = '',
  theme = 'auto',
}) => {
  const {
    connected,
    state,
    plan,
    currentStepId,
    result,
    logs,
    submitTask,
    cancelTask,
    confirmStep,
  } = useAgent({
    wsUrl,
    onError,
  });

  // Handle task complete callback
  useEffect(() => {
    if (result && onTaskComplete) {
      onTaskComplete(result);
    }
  }, [result, onTaskComplete]);

  // Determine theme
  useEffect(() => {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const isWorking = state === 'planning' || state === 'executing';

  return (
    <div className={`agent-panel ${className}`}>
      {/* Header */}
      <div className="agent-header">
        <div className="agent-header-title">
          <div className="agent-header-logo">A</div>
          <span>Agent Core</span>
        </div>
        <div className="agent-status">
          <div className={`agent-status-dot ${connected ? 'connected' : ''} ${state}`} />
          <span>{connected ? stateLabels[state] : '未连接'}</span>
        </div>
      </div>

      {/* Content */}
      <div className="agent-content">
        {/* Task Input */}
        <TaskInput
          onSubmit={submitTask}
          disabled={!connected || isWorking}
          placeholder={connected ? '输入任务描述...' : '等待连接...'}
        />

        {/* Cancel Button */}
        {isWorking && (
          <div style={{ padding: '0 16px', marginBottom: 8 }}>
            <button 
              className="agent-btn agent-btn-danger"
              onClick={cancelTask}
              style={{ width: '100%' }}
            >
              取消任务
            </button>
          </div>
        )}

        {/* Waiting for Confirmation */}
        {state === 'waiting' && currentStepId && (
          <div className="agent-confirm">
            <div className="agent-confirm-title">需要确认</div>
            <div className="agent-confirm-msg">
              是否继续执行下一步？
            </div>
            <div className="agent-confirm-actions">
              <button 
                className="agent-btn agent-btn-primary"
                onClick={() => confirmStep(currentStepId, true)}
              >
                确认继续
              </button>
              <button 
                className="agent-btn agent-btn-secondary"
                onClick={() => confirmStep(currentStepId, false)}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Plan View */}
        <PlanView plan={plan} currentStepId={currentStepId} />

        {/* Result */}
        <ResultView 
          result={result}
          onNewTask={() => {
            // Reset state handled by submitTask
          }}
        />
      </div>

      {/* Log Panel */}
      <LogPanel logs={logs} />
    </div>
  );
};

export default AgentPanel;
