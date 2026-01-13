// ============================================
// Agent Core - Utility Functions
// ============================================

import { EventCallback, EventEmitterInterface } from '../types';

// -------------------- ID Generator --------------------

let idCounter = 0;

export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const counter = (idCounter++).toString(36);
  return `${prefix}_${timestamp}_${random}_${counter}`;
}

// -------------------- Event Emitter --------------------

export class EventEmitter implements EventEmitterInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listeners.get(event)!.add(callback as EventCallback<any>);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<T>(event: string, data: T): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// -------------------- Async Utilities --------------------

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message || `Timeout after ${ms}ms`));
    }, ms);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    delay: number;
    backoff?: number;
    onRetry?: (error: Error, attempt: number) => void;
  }
): Promise<T> {
  const { maxRetries, delay: retryDelay, backoff = 1.5, onRetry } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        onRetry?.(lastError, attempt + 1);
        await delay(retryDelay * Math.pow(backoff, attempt));
      }
    }
  }

  throw lastError!;
}

// -------------------- Object Utilities --------------------

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }

  if (obj instanceof Map) {
    const result = new Map();
    obj.forEach((value, key) => {
      result.set(key, deepClone(value));
    });
    return result as any;
  }

  if (obj instanceof Set) {
    const result = new Set();
    obj.forEach(value => {
      result.add(deepClone(value));
    });
    return result as any;
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone((obj as any)[key]);
    }
  }
  return result;
}

export function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Handle array index notation: items[0]
    const match = key.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      current = current[match[1]]?.[parseInt(match[2])];
    } else {
      current = current[key];
    }
  }

  return current;
}

export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

// -------------------- Template Resolution --------------------

export function resolveTemplate(
  template: string,
  context: Record<string, any>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path.trim());
    if (value === undefined) {
      console.warn(`Template variable not found: ${path}`);
      return match;
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

export function resolveParams(
  params: Record<string, any>,
  context: Record<string, any>
): Record<string, any> {
  const resolved: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      if (value.startsWith('{{') && value.endsWith('}}')) {
        // Direct reference: {{path.to.value}}
        const path = value.slice(2, -2).trim();
        resolved[key] = getNestedValue(context, path);
      } else if (value.includes('{{')) {
        // Template string with embedded references
        resolved[key] = resolveTemplate(value, context);
      } else {
        resolved[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveParams(value, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

// -------------------- Expression Evaluator --------------------

export function evaluateCondition(
  condition: string,
  context: Record<string, any>
): boolean {
  // Safe expression evaluator (limited operations)
  const safeContext = { ...context };
  
  // Replace variable references
  const processedCondition = condition.replace(
    /\$\{([^}]+)\}/g,
    (_, path) => {
      const value = getNestedValue(safeContext, path.trim());
      return JSON.stringify(value);
    }
  );

  try {
    // Only allow safe operations
    const allowedPattern = /^[\s\w.[\]"'<>=!&|+\-*/%()]+$/;
    if (!allowedPattern.test(processedCondition)) {
      throw new Error('Unsafe expression detected');
    }

    // Create sandboxed evaluation
    const fn = new Function('ctx', `
      with (ctx) {
        return ${processedCondition};
      }
    `);
    
    return Boolean(fn(safeContext));
  } catch (error) {
    console.error('Condition evaluation failed:', error);
    return false;
  }
}

// -------------------- Topological Sort --------------------

export function topologicalSort<T extends { id: string; dependsOn?: string[] }>(
  items: T[]
): T[] {
  const itemMap = new Map(items.map(item => [item.id, item]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  items.forEach(item => {
    inDegree.set(item.id, 0);
    adjacency.set(item.id, []);
  });

  // Build graph
  items.forEach(item => {
    (item.dependsOn || []).forEach(depId => {
      if (itemMap.has(depId)) {
        adjacency.get(depId)!.push(item.id);
        inDegree.set(item.id, inDegree.get(item.id)! + 1);
      }
    });
  });

  // Kahn's algorithm
  const queue: string[] = [];
  const result: T[] = [];

  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(itemMap.get(id)!);

    adjacency.get(id)!.forEach(neighborId => {
      const newDegree = inDegree.get(neighborId)! - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) {
        queue.push(neighborId);
      }
    });
  }

  // Check for cycles
  if (result.length !== items.length) {
    throw new Error('Circular dependency detected');
  }

  return result;
}

// -------------------- Validation --------------------

export function validateParams(
  params: Record<string, any>,
  schema: Array<{ name: string; type: string; required: boolean }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const param of schema) {
    const value = params[param.name];

    if (param.required && (value === undefined || value === null)) {
      errors.push(`Missing required parameter: ${param.name}`);
      continue;
    }

    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== param.type) {
        errors.push(`Parameter "${param.name}" should be ${param.type}, got ${actualType}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// -------------------- Formatting --------------------

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
