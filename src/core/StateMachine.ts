// ============================================
// Agent Core - State Machine
// ============================================

import {
  AgentState,
  StateContext,
  StateTransition,
  TransitionEvent,
  ExecutionPlan,
  StepResult
} from '../types';
import { EventEmitter, generateId } from '../utils';

export class StateMachine extends EventEmitter {
  private context: StateContext;
  private transitions: StateTransition[];
  private history: TransitionEvent[] = [];

  constructor() {
    super();
    this.context = this.createInitialContext();
    this.transitions = this.defineTransitions();
  }

  // -------------------- Context Management --------------------

  private createInitialContext(): StateContext {
    return {
      state: AgentState.IDLE,
      taskId: '',
      task: '',
      plan: null,
      currentStepIndex: -1,
      results: [],
      error: null,
      startTime: 0,
      metadata: {}
    };
  }

  public reset(): void {
    const previousState = this.context.state;
    this.context = this.createInitialContext();
    this.history = [];
    
    if (previousState !== AgentState.IDLE) {
      this.emit('transition', {
        from: previousState,
        to: AgentState.IDLE,
        trigger: 'RESET',
        timestamp: Date.now()
      });
    }
  }

  public getState(): AgentState {
    return this.context.state;
  }

  public getContext(): Readonly<StateContext> {
    return { ...this.context };
  }

  public updateContext(updates: Partial<StateContext>): void {
    this.context = { ...this.context, ...updates };
    this.emit('context:updated', this.getContext());
  }

  public getHistory(): TransitionEvent[] {
    return [...this.history];
  }

  // -------------------- Transition Definitions --------------------

  private defineTransitions(): StateTransition[] {
    return [
      // IDLE -> PLANNING
      {
        from: AgentState.IDLE,
        to: AgentState.PLANNING,
        trigger: 'START_TASK',
        action: (ctx, payload) => {
          ctx.taskId = generateId('task');
          ctx.task = payload?.task || '';
          ctx.startTime = Date.now();
          ctx.results = [];
          ctx.error = null;
        }
      },

      // PLANNING -> EXECUTING
      {
        from: AgentState.PLANNING,
        to: AgentState.EXECUTING,
        trigger: 'PLAN_READY',
        guard: (ctx) => ctx.plan !== null && ctx.plan.steps.length > 0,
        action: (ctx) => {
          ctx.currentStepIndex = 0;
        }
      },

      // PLANNING -> ERROR
      {
        from: AgentState.PLANNING,
        to: AgentState.ERROR,
        trigger: 'PLAN_FAILED',
        action: (ctx, payload) => {
          ctx.error = payload?.error || new Error('Planning failed');
        }
      },

      // PLANNING -> IDLE (cancel)
      {
        from: AgentState.PLANNING,
        to: AgentState.IDLE,
        trigger: 'CANCEL'
      },

      // EXECUTING -> EXECUTING (next step)
      {
        from: AgentState.EXECUTING,
        to: AgentState.EXECUTING,
        trigger: 'STEP_COMPLETE',
        guard: (ctx) => {
          const hasMoreSteps = ctx.plan !== null && 
            ctx.currentStepIndex < ctx.plan.steps.length - 1;
          return hasMoreSteps;
        },
        action: (ctx, payload) => {
          if (payload?.result) {
            ctx.results.push(payload.result);
          }
          ctx.currentStepIndex++;
        }
      },

      // EXECUTING -> COMPLETE (last step done)
      {
        from: AgentState.EXECUTING,
        to: AgentState.COMPLETE,
        trigger: 'STEP_COMPLETE',
        guard: (ctx) => {
          const isLastStep = ctx.plan !== null && 
            ctx.currentStepIndex >= ctx.plan.steps.length - 1;
          return isLastStep;
        },
        action: (ctx, payload) => {
          if (payload?.result) {
            ctx.results.push(payload.result);
          }
        }
      },

      // EXECUTING -> WAITING (need confirmation)
      {
        from: AgentState.EXECUTING,
        to: AgentState.WAITING,
        trigger: 'NEED_CONFIRMATION',
        action: (ctx, payload) => {
          ctx.metadata.waitingFor = payload?.reason || 'user_confirmation';
          ctx.metadata.waitingData = payload?.data;
        }
      },

      // EXECUTING -> ERROR
      {
        from: AgentState.EXECUTING,
        to: AgentState.ERROR,
        trigger: 'EXECUTION_FAILED',
        action: (ctx, payload) => {
          ctx.error = payload?.error || new Error('Execution failed');
          if (payload?.result) {
            ctx.results.push(payload.result);
          }
        }
      },

      // EXECUTING -> IDLE (cancel)
      {
        from: AgentState.EXECUTING,
        to: AgentState.IDLE,
        trigger: 'CANCEL',
        action: (ctx) => {
          ctx.metadata.cancelled = true;
        }
      },

      // WAITING -> EXECUTING (user confirmed)
      {
        from: AgentState.WAITING,
        to: AgentState.EXECUTING,
        trigger: 'USER_CONFIRMED',
        action: (ctx, payload) => {
          ctx.metadata.confirmationData = payload;
          delete ctx.metadata.waitingFor;
          delete ctx.metadata.waitingData;
        }
      },

      // WAITING -> ERROR (user rejected or timeout)
      {
        from: AgentState.WAITING,
        to: AgentState.ERROR,
        trigger: 'USER_REJECTED',
        action: (ctx, payload) => {
          ctx.error = new Error(payload?.reason || 'User rejected');
        }
      },

      // WAITING -> IDLE (cancel)
      {
        from: AgentState.WAITING,
        to: AgentState.IDLE,
        trigger: 'CANCEL'
      },

      // COMPLETE -> IDLE
      {
        from: AgentState.COMPLETE,
        to: AgentState.IDLE,
        trigger: 'RESET'
      },

      // ERROR -> IDLE
      {
        from: AgentState.ERROR,
        to: AgentState.IDLE,
        trigger: 'RESET'
      },

      // ERROR -> PLANNING (retry)
      {
        from: AgentState.ERROR,
        to: AgentState.PLANNING,
        trigger: 'RETRY',
        action: (ctx) => {
          ctx.error = null;
          ctx.plan = null;
          ctx.currentStepIndex = -1;
          ctx.results = [];
        }
      }
    ];
  }

  // -------------------- State Transitions --------------------

  public dispatch(trigger: string, payload?: any): boolean {
    const currentState = this.context.state;
    
    // Find matching transition
    const transition = this.transitions.find(t => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from];
      return fromStates.includes(currentState) && t.trigger === trigger;
    });

    if (!transition) {
      console.warn(
        `[StateMachine] No transition found for trigger "${trigger}" from state "${currentState}"`
      );
      this.emit('transition:invalid', { currentState, trigger, payload });
      return false;
    }

    // Check guard condition
    if (transition.guard && !transition.guard(this.context)) {
      console.warn(
        `[StateMachine] Guard blocked transition "${trigger}" from "${currentState}"`
      );
      this.emit('transition:blocked', { currentState, trigger, payload });
      return false;
    }

    // Execute transition
    const previousState = this.context.state;
    this.context.state = transition.to;

    // Execute action
    if (transition.action) {
      transition.action(this.context, payload);
    }

    // Record history
    const event: TransitionEvent = {
      from: previousState,
      to: transition.to,
      trigger,
      timestamp: Date.now()
    };
    this.history.push(event);

    // Emit events
    this.emit('transition', event);
    this.emit(`state:${transition.to.toLowerCase()}`, this.getContext());

    console.log(
      `[StateMachine] ${previousState} -> ${transition.to} (${trigger})`
    );

    return true;
  }

  // -------------------- Convenience Methods --------------------

  public canDispatch(trigger: string): boolean {
    const currentState = this.context.state;
    
    return this.transitions.some(t => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from];
      if (!fromStates.includes(currentState) || t.trigger !== trigger) {
        return false;
      }
      if (t.guard && !t.guard(this.context)) {
        return false;
      }
      return true;
    });
  }

  public getAvailableTriggers(): string[] {
    const currentState = this.context.state;
    
    return this.transitions
      .filter(t => {
        const fromStates = Array.isArray(t.from) ? t.from : [t.from];
        return fromStates.includes(currentState);
      })
      .map(t => t.trigger);
  }

  public isIdle(): boolean {
    return this.context.state === AgentState.IDLE;
  }

  public isRunning(): boolean {
    return [AgentState.PLANNING, AgentState.EXECUTING].includes(this.context.state);
  }

  public isWaiting(): boolean {
    return this.context.state === AgentState.WAITING;
  }

  public isComplete(): boolean {
    return this.context.state === AgentState.COMPLETE;
  }

  public isError(): boolean {
    return this.context.state === AgentState.ERROR;
  }

  // -------------------- Plan Management --------------------

  public setPlan(plan: ExecutionPlan): void {
    this.context.plan = plan;
    this.emit('plan:set', plan);
  }

  public getCurrentStep(): { step: any; index: number } | null {
    if (!this.context.plan || this.context.currentStepIndex < 0) {
      return null;
    }
    
    return {
      step: this.context.plan.steps[this.context.currentStepIndex],
      index: this.context.currentStepIndex
    };
  }

  public addResult(result: StepResult): void {
    this.context.results.push(result);
    this.emit('result:added', result);
  }

  // -------------------- Serialization --------------------

  public serialize(): string {
    return JSON.stringify({
      context: {
        ...this.context,
        error: this.context.error ? {
          message: this.context.error.message,
          name: this.context.error.name
        } : null
      },
      history: this.history
    });
  }

  public deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      this.context = {
        ...parsed.context,
        error: parsed.context.error 
          ? new Error(parsed.context.error.message)
          : null
      };
      
      this.history = parsed.history || [];
      
      this.emit('deserialized', this.getContext());
    } catch (error) {
      throw new Error(`Failed to deserialize state: ${error}`);
    }
  }
}
