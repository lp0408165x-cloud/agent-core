// ============================================
// Agent Core UI - Plan View Component
// ============================================

import React from 'react';
import { StepCard } from './StepCard';
import type { PlanViewProps } from '../types';

export const PlanView: React.FC<PlanViewProps> = ({
  plan,
  currentStepId,
}) => {
  if (!plan) {
    return (
      <div className="agent-plan">
        <div className="agent-empty">
          <div className="agent-empty-icon">📋</div>
          <div className="agent-empty-text">
            输入任务开始执行
          </div>
        </div>
      </div>
    );
  }

  const completedSteps = plan.steps.filter(s => s.status === 'success').length;
  const totalSteps = plan.steps.length;

  return (
    <div className="agent-plan">
      <div className="agent-plan-header">
        <div className="agent-plan-title">执行计划</div>
        <div className="agent-plan-meta">
          {completedSteps}/{totalSteps} 步骤
        </div>
      </div>
      <div className="agent-steps">
        {plan.steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            isActive={step.id === currentStepId}
          />
        ))}
      </div>
    </div>
  );
};

export default PlanView;
