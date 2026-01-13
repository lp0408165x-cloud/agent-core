// ============================================
// Agent Core UI - Result View Component
// ============================================

import React from 'react';
import type { ResultViewProps } from '../types';

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  onNewTask,
}) => {
  if (!result) return null;

  const formatOutput = (output: unknown): string => {
    if (output === undefined || output === null) return '';
    if (typeof output === 'string') return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  };

  return (
    <div className="agent-result">
      <div className="agent-result-header">
        <div className={`agent-result-icon ${result.success ? 'success' : 'error'}`}>
          {result.success ? '✓' : '✗'}
        </div>
        <div className="agent-result-title">
          {result.success ? '任务完成' : '任务失败'}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--agent-text-muted)' }}>
          {result.duration}ms
        </span>
      </div>
      
      {result.summary && (
        <div className="agent-result-summary">{result.summary}</div>
      )}
      
      {result.error && (
        <div className="agent-result-summary" style={{ color: 'var(--agent-error)' }}>
          {result.error}
        </div>
      )}
      
      {result.output && (
        <pre className="agent-result-output">
          {formatOutput(result.output)}
        </pre>
      )}

      {onNewTask && (
        <div style={{ marginTop: 12 }}>
          <button className="agent-btn agent-btn-secondary" onClick={onNewTask}>
            新任务
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultView;
