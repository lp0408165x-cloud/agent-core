// ============================================
// Agent Core UI - Task Input Component
// ============================================

import React, { useState, useCallback, KeyboardEvent } from 'react';
import type { TaskInputProps } from '../types';

export const TaskInput: React.FC<TaskInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = '输入任务描述...',
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    const task = value.trim();
    if (task && !disabled) {
      onSubmit(task);
      setValue('');
    }
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="agent-input-section">
      <div className="agent-input-wrapper">
        <input
          type="text"
          className="agent-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          className="agent-btn agent-btn-primary"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
        >
          执行
        </button>
      </div>
    </div>
  );
};

export default TaskInput;
