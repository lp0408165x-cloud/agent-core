// ============================================
// Agent Core UI - Step Card Component
// ============================================

import React from 'react';
import type { StepCardProps } from '../types';

export const StepCard: React.FC<StepCardProps> = ({
  step,
  isActive,
  index,
}) => {
  const getStatusClass = () => {
    if (step.status === 'success') return 'success';
    if (step.status === 'failed') return 'failed';
    if (step.status === 'running') return 'running';
    return '';
  };

  const getStatusIcon = () => {
    switch (step.status) {
      case 'success': return '✓';
      case 'failed': return '✗';
      case 'running': return '●';
      case 'skipped': return '–';
      default: return String(index + 1);
    }
  };

  return (
    <div className={`agent-step ${getStatusClass()} ${isActive ? 'active' : ''}`}>
      <div className="agent-step-number">
        {getStatusIcon()}
      </div>
      <div className="agent-step-content">
        <div className="agent-step-name">{step.name}</div>
        <div className="agent-step-desc">{step.description}</div>
        <div className="agent-step-meta">
          <span className="agent-step-tag">{step.type}</span>
          {step.tool && <span className="agent-step-tag">{step.tool}</span>}
          {step.duration !== undefined && (
            <span className="agent-step-duration">{step.duration}ms</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepCard;
