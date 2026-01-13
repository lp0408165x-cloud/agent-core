// ============================================
// Agent Core - Core Planner
// ============================================

import {
  ExecutionPlan,
  ExecutionStep,
  TaskAnalysis,
  PlannerConfig,
  LLMClient,
  StepType
} from '../types';
import { ToolRegistry } from './ToolRegistry';
import { 
  EventEmitter, 
  generateId, 
  topologicalSort,
  timeout 
} from '../utils';

export class CorePlanner extends EventEmitter {
  private llm: LLMClient;
  private config: PlannerConfig;
  private toolRegistry: ToolRegistry;

  constructor(
    llm: LLMClient,
    config: PlannerConfig,
    toolRegistry: ToolRegistry
  ) {
    super();
    this.llm = llm;
    this.config = config;
    this.toolRegistry = toolRegistry;
  }

  // -------------------- Main Planning Method --------------------

  public async createPlan(
    task: string,
    context?: Record<string, any>
  ): Promise<ExecutionPlan> {
    this.emit('planning:start', { task });

    try {
      // 1. Analyze task
      this.emit('planning:phase', { phase: 'analyzing' });
      const analysis = await this.analyzeTask(task, context);
      this.emit('planning:analyzed', { analysis });

      // 2. Generate steps
      this.emit('planning:phase', { phase: 'generating' });
      const rawSteps = await this.generateSteps(task, analysis);
      this.emit('planning:generated', { stepCount: rawSteps.length });

      // 3. Optimize dependencies
      this.emit('planning:phase', { phase: 'optimizing' });
      const optimizedSteps = this.optimizeDependencies(rawSteps);

      // 4. Validate plan
      this.emit('planning:phase', { phase: 'validating' });
      this.validatePlan(optimizedSteps);

      // 5. Create plan object
      const plan: ExecutionPlan = {
        id: generateId('plan'),
        taskDescription: task,
        steps: optimizedSteps,
        estimatedTime: this.estimateTime(optimizedSteps),
        createdAt: new Date(),
        metadata: {
          analysis,
          context: context || {}
        }
      };

      this.emit('planning:complete', { plan });
      return plan;

    } catch (error) {
      this.emit('planning:error', { error });
      throw error;
    }
  }

  // -------------------- Task Analysis --------------------

  private async analyzeTask(
    task: string,
    context?: Record<string, any>
  ): Promise<TaskAnalysis> {
    const availableTools = this.toolRegistry.getToolNames().join(', ');

    const prompt = `
分析以下任务，返回JSON格式的分析结果。

任务: ${task}

${context ? `上下文: ${JSON.stringify(context, null, 2)}` : ''}

可用工具: ${availableTools}

请分析并返回以下JSON结构（不要包含其他内容）:
{
  "taskType": "retrieval|document|analysis|code|other",
  "resources": ["需要的资源列表"],
  "outputFormat": "预期输出格式描述",
  "risks": ["潜在风险点"],
  "confirmationPoints": ["需要用户确认的关键节点"],
  "complexity": "low|medium|high"
}
`;

    const response = await timeout(
      this.llm.complete(prompt),
      this.config.planningTimeout,
      'Task analysis timed out'
    );

    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as TaskAnalysis;
    } catch (error) {
      console.error('Failed to parse task analysis:', error);
      // Return default analysis
      return {
        taskType: 'other',
        resources: [],
        outputFormat: 'text',
        risks: [],
        confirmationPoints: [],
        complexity: 'medium'
      };
    }
  }

  // -------------------- Step Generation --------------------

  private async generateSteps(
    task: string,
    analysis: TaskAnalysis
  ): Promise<ExecutionStep[]> {
    const toolDescriptions = this.toolRegistry.getToolDescriptions();

    const prompt = `
基于任务分析，生成执行步骤。

任务: ${task}

任务分析:
${JSON.stringify(analysis, null, 2)}

可用工具:
${toolDescriptions}

要求:
1. 每个步骤必须有唯一ID (格式: step_1, step_2, ...)
2. type 必须是: tool, llm, conditional, loop, parallel 之一
3. 使用工具时必须指定 tool 字段
4. 步骤之间的依赖用 dependsOn 数组指定
5. 需要用户确认的步骤设置 needConfirmation: true
6. 可能失败的步骤设置 retryable: true
7. 最多 ${this.config.maxSteps} 个步骤

返回JSON数组格式（不要包含其他内容）:
[
  {
    "id": "step_1",
    "type": "tool",
    "name": "步骤名称",
    "description": "步骤描述",
    "tool": "工具名称",
    "params": {},
    "dependsOn": [],
    "retryable": false,
    "timeout": 30000,
    "needConfirmation": false
  }
]
`;

    const response = await timeout(
      this.llm.complete(prompt),
      this.config.planningTimeout,
      'Step generation timed out'
    );

    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      
      const steps = JSON.parse(jsonMatch[0]) as ExecutionStep[];
      
      // Validate and normalize steps
      return steps.map((step, index) => this.normalizeStep(step, index));
    } catch (error) {
      console.error('Failed to parse steps:', error);
      throw new Error(`Failed to generate execution steps: ${error}`);
    }
  }

  private normalizeStep(step: Partial<ExecutionStep>, index: number): ExecutionStep {
    return {
      id: step.id || `step_${index + 1}`,
      type: this.validateStepType(step.type),
      name: step.name || `Step ${index + 1}`,
      description: step.description || '',
      tool: step.tool,
      params: step.params || {},
      dependsOn: step.dependsOn || [],
      condition: step.condition,
      retryable: step.retryable ?? false,
      maxRetries: step.maxRetries ?? 3,
      timeout: step.timeout ?? 30000,
      needConfirmation: step.needConfirmation ?? false,
      children: step.children
    };
  }

  private validateStepType(type: any): StepType {
    const validTypes: StepType[] = ['tool', 'llm', 'conditional', 'loop', 'parallel'];
    if (validTypes.includes(type)) {
      return type;
    }
    return 'llm'; // Default to LLM step
  }

  // -------------------- Dependency Optimization --------------------

  private optimizeDependencies(steps: ExecutionStep[]): ExecutionStep[] {
    // Remove invalid dependencies
    const stepIds = new Set(steps.map(s => s.id));
    
    const cleanedSteps = steps.map(step => ({
      ...step,
      dependsOn: (step.dependsOn || []).filter(depId => stepIds.has(depId))
    }));

    // Topological sort
    try {
      return topologicalSort(cleanedSteps);
    } catch (error) {
      console.warn('Dependency optimization failed, using original order:', error);
      return cleanedSteps;
    }
  }

  // -------------------- Plan Validation --------------------

  private validatePlan(steps: ExecutionStep[]): void {
    if (steps.length === 0) {
      throw new Error('Plan must have at least one step');
    }

    if (steps.length > this.config.maxSteps) {
      throw new Error(
        `Plan exceeds maximum steps (${steps.length} > ${this.config.maxSteps})`
      );
    }

    // Check tool availability
    for (const step of steps) {
      if (step.type === 'tool' && step.tool) {
        if (!this.toolRegistry.hasTool(step.tool)) {
          throw new Error(`Unknown tool in step "${step.id}": ${step.tool}`);
        }
      }
    }

    // Check for missing dependencies
    const stepIds = new Set(steps.map(s => s.id));
    for (const step of steps) {
      for (const depId of step.dependsOn || []) {
        if (!stepIds.has(depId)) {
          throw new Error(
            `Step "${step.id}" depends on unknown step "${depId}"`
          );
        }
      }
    }
  }

  // -------------------- Time Estimation --------------------

  private estimateTime(steps: ExecutionStep[]): number {
    return steps.reduce((total, step) => {
      const baseTime = step.timeout || 30000;
      const retryFactor = step.retryable ? 1.5 : 1;
      return total + (baseTime * retryFactor);
    }, 0);
  }

  // -------------------- Re-planning --------------------

  public async replan(
    originalPlan: ExecutionPlan,
    failedStep: ExecutionStep,
    error: Error,
    completedResults: Record<string, any>
  ): Promise<ExecutionPlan> {
    this.emit('replanning:start', { originalPlan, failedStep, error });

    const prompt = `
执行计划中的步骤失败，需要重新规划。

原计划:
${JSON.stringify(originalPlan.steps.map(s => ({ id: s.id, name: s.name, type: s.type })), null, 2)}

失败步骤:
${JSON.stringify(failedStep, null, 2)}

错误信息: ${error.message}

已完成的步骤结果:
${JSON.stringify(completedResults, null, 2)}

可用工具:
${this.toolRegistry.getToolNames().join(', ')}

请生成替代方案，返回JSON数组格式的新步骤（从失败点继续）:
`;

    const response = await timeout(
      this.llm.complete(prompt),
      this.config.planningTimeout,
      'Replanning timed out'
    );

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in replan response');
      }

      const newSteps = JSON.parse(jsonMatch[0]) as ExecutionStep[];
      const normalizedSteps = newSteps.map((s, i) => this.normalizeStep(s, i));

      const replan: ExecutionPlan = {
        id: generateId('replan'),
        taskDescription: originalPlan.taskDescription,
        steps: normalizedSteps,
        estimatedTime: this.estimateTime(normalizedSteps),
        createdAt: new Date(),
        metadata: {
          ...originalPlan.metadata,
          isReplan: true,
          originalPlanId: originalPlan.id,
          failedStepId: failedStep.id,
          failureReason: error.message
        }
      };

      this.emit('replanning:complete', { replan });
      return replan;

    } catch (parseError) {
      this.emit('replanning:error', { error: parseError });
      throw new Error(`Failed to generate replan: ${parseError}`);
    }
  }

  // -------------------- Plan Modification --------------------

  public insertStep(
    plan: ExecutionPlan,
    step: ExecutionStep,
    afterStepId?: string
  ): ExecutionPlan {
    const steps = [...plan.steps];
    
    if (afterStepId) {
      const index = steps.findIndex(s => s.id === afterStepId);
      if (index === -1) {
        throw new Error(`Step not found: ${afterStepId}`);
      }
      steps.splice(index + 1, 0, step);
    } else {
      steps.push(step);
    }

    return {
      ...plan,
      steps: this.optimizeDependencies(steps),
      metadata: {
        ...plan.metadata,
        modified: true,
        modifiedAt: new Date()
      }
    };
  }

  public removeStep(plan: ExecutionPlan, stepId: string): ExecutionPlan {
    const steps = plan.steps.filter(s => s.id !== stepId);
    
    // Remove dependencies on removed step
    const cleanedSteps = steps.map(s => ({
      ...s,
      dependsOn: (s.dependsOn || []).filter(depId => depId !== stepId)
    }));

    return {
      ...plan,
      steps: cleanedSteps,
      metadata: {
        ...plan.metadata,
        modified: true,
        modifiedAt: new Date()
      }
    };
  }

  public updateStep(
    plan: ExecutionPlan,
    stepId: string,
    updates: Partial<ExecutionStep>
  ): ExecutionPlan {
    const steps = plan.steps.map(s => 
      s.id === stepId ? { ...s, ...updates } : s
    );

    return {
      ...plan,
      steps,
      metadata: {
        ...plan.metadata,
        modified: true,
        modifiedAt: new Date()
      }
    };
  }

  // -------------------- Plan Analysis --------------------

  public analyzePlan(plan: ExecutionPlan): {
    totalSteps: number;
    toolSteps: number;
    llmSteps: number;
    parallelizable: string[][];
    estimatedTime: number;
    riskPoints: string[];
  } {
    const toolSteps = plan.steps.filter(s => s.type === 'tool').length;
    const llmSteps = plan.steps.filter(s => s.type === 'llm').length;

    // Find parallelizable groups
    const parallelizable = this.findParallelGroups(plan.steps);

    // Identify risk points
    const riskPoints = plan.steps
      .filter(s => !s.retryable && s.type === 'tool')
      .map(s => `Step "${s.name}" (${s.id}) is not retryable`);

    return {
      totalSteps: plan.steps.length,
      toolSteps,
      llmSteps,
      parallelizable,
      estimatedTime: plan.estimatedTime,
      riskPoints
    };
  }

  private findParallelGroups(steps: ExecutionStep[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();

    for (const step of steps) {
      if (processed.has(step.id)) continue;

      // Find steps that can run in parallel with this one
      const parallelGroup = [step.id];
      
      for (const other of steps) {
        if (other.id === step.id || processed.has(other.id)) continue;

        // Steps can be parallel if neither depends on the other
        const stepDeps = new Set(step.dependsOn || []);
        const otherDeps = new Set(other.dependsOn || []);

        if (!stepDeps.has(other.id) && !otherDeps.has(step.id)) {
          // Check if they have the same dependencies
          const sameDeps = [...stepDeps].every(d => otherDeps.has(d)) &&
                          [...otherDeps].every(d => stepDeps.has(d));
          if (sameDeps) {
            parallelGroup.push(other.id);
          }
        }
      }

      if (parallelGroup.length > 1) {
        groups.push(parallelGroup);
        parallelGroup.forEach(id => processed.add(id));
      }
    }

    return groups;
  }
}
