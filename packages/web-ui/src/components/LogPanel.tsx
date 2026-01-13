// ============================================
// Agent Core UI - Log Panel Component
// ============================================

import React, { useEffect, useRef } from 'react';
import type { LogPanelProps } from '../types';

export const LogPanel: React.FC<LogPanelProps> = ({
  logs,
  maxHeight = 200,
  autoScroll = true,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="agent-logs" style={{ maxHeight }}>
      <div className="agent-logs-header">
        <span>日志</span>
        <span>{logs.length} 条</span>
      </div>
      <div className="agent-logs-list" ref={listRef}>
        {logs.map((log) => (
          <div key={log.id} className={`agent-log-entry ${log.level}`}>
            <span className="agent-log-time">{formatTime(log.timestamp)}</span>
            <span className="agent-log-msg">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogPanel;
