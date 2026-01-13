// ============================================
// Agent Core - Example Plugins
// ============================================

import type {
  ToolPlugin,
  LLMPlugin,
  StoragePlugin,
  MiddlewarePlugin,
  ExtensionPlugin,
  PluginContext,
  MiddlewareContext
} from './types';
import type { ToolDefinition, LLMClient, LLMMessage } from '../types';

// ================== Tool Plugin Example ==================

/**
 * Example: Weather Tool Plugin
 */
export const weatherToolPlugin: ToolPlugin = {
  id: 'weather-tools',
  name: 'Weather Tools',
  version: '1.0.0',
  type: 'tool',
  description: 'Provides weather-related tools',
  author: 'Agent Core',
  
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      category: 'weather',
      returns: 'Weather data object',
      parameters: [
        {
          name: 'location',
          type: 'string',
          required: true,
          description: 'City name or coordinates'
        },
        {
          name: 'units',
          type: 'string',
          required: false,
          description: 'Temperature units: celsius or fahrenheit'
        }
      ],
      async execute(params) {
        // Mock implementation
        const { location, units = 'celsius' } = params;
        return {
          success: true,
          data: {
            location,
            temperature: units === 'celsius' ? 22 : 72,
            units,
            condition: 'sunny',
            humidity: 45,
            wind: { speed: 10, direction: 'NW' }
          }
        };
      }
    },
    {
      name: 'get_forecast',
      description: 'Get weather forecast for next days',
      category: 'weather',
      returns: 'Forecast array',
      parameters: [
        {
          name: 'location',
          type: 'string',
          required: true,
          description: 'City name or coordinates'
        },
        {
          name: 'days',
          type: 'number',
          required: false,
          description: 'Number of days (1-7)'
        }
      ],
      async execute(params) {
        const { location, days = 3 } = params;
        const forecast = Array.from({ length: days }, (_, i) => ({
          date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
          high: 20 + Math.floor(Math.random() * 10),
          low: 10 + Math.floor(Math.random() * 10),
          condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
        }));
        
        return {
          success: true,
          data: { location, forecast }
        };
      }
    }
  ],
  
  init(context: PluginContext) {
    context.logger.info('Weather tools initialized');
  }
};

// ================== LLM Plugin Example ==================

/**
 * Example: Custom LLM Provider Plugin
 */
export const customLLMPlugin: LLMPlugin = {
  id: 'custom-llm',
  name: 'Custom LLM Provider',
  version: '1.0.0',
  type: 'llm',
  description: 'Example custom LLM provider',
  provider: 'custom',
  
  defaultConfig: {
    apiKey: '',
    baseURL: 'https://api.custom-llm.com',
    model: 'custom-model-v1'
  },
  
  configSchema: {
    apiKey: {
      type: 'string',
      required: true,
      description: 'API key for authentication'
    },
    baseURL: {
      type: 'string',
      required: false,
      description: 'API base URL'
    },
    model: {
      type: 'string',
      required: false,
      description: 'Model name'
    }
  },
  
  createClient(config: Record<string, any>): LLMClient {
    const { apiKey, baseURL, model } = { ...this.defaultConfig, ...config };
    
    return {
      async complete(prompt: string): Promise<string> {
        // Mock implementation
        return `[Custom LLM Response to: ${prompt.substring(0, 50)}...]`;
      },
      
      async chat(messages: LLMMessage[]): Promise<string> {
        const lastMessage = messages[messages.length - 1];
        return `[Custom LLM Response to: ${lastMessage?.content.substring(0, 50)}...]`;
      }
    };
  }
};

// ================== Storage Plugin Example ==================

/**
 * Example: Redis Storage Plugin
 */
export const redisStoragePlugin: StoragePlugin = {
  id: 'redis-storage',
  name: 'Redis Storage',
  version: '1.0.0',
  type: 'storage',
  description: 'Redis-based storage adapter',
  storageType: 'redis',
  
  defaultConfig: {
    host: 'localhost',
    port: 6379,
    prefix: 'agent:'
  },
  
  configSchema: {
    host: {
      type: 'string',
      required: false,
      default: 'localhost',
      description: 'Redis host'
    },
    port: {
      type: 'number',
      required: false,
      default: 6379,
      description: 'Redis port'
    },
    password: {
      type: 'string',
      required: false,
      description: 'Redis password'
    },
    prefix: {
      type: 'string',
      required: false,
      default: 'agent:',
      description: 'Key prefix'
    }
  },
  
  createAdapter(config: Record<string, any>) {
    const { prefix } = { ...this.defaultConfig, ...config };
    
    // Mock implementation (would use actual Redis client)
    const store = new Map<string, string>();
    
    return {
      async get<T>(key: string): Promise<T | null> {
        const data = store.get(prefix + key);
        return data ? JSON.parse(data) : null;
      },
      
      async set<T>(key: string, value: T, _ttl?: number): Promise<void> {
        store.set(prefix + key, JSON.stringify(value));
      },
      
      async delete(key: string): Promise<boolean> {
        return store.delete(prefix + key);
      },
      
      async exists(key: string): Promise<boolean> {
        return store.has(prefix + key);
      },
      
      async getMany<T>(keys: string[]): Promise<Map<string, T>> {
        const result = new Map<string, T>();
        for (const key of keys) {
          const data = store.get(prefix + key);
          if (data) result.set(key, JSON.parse(data));
        }
        return result;
      },
      
      async setMany<T>(entries: Map<string, T>, _ttl?: number): Promise<void> {
        for (const [key, value] of entries) {
          store.set(prefix + key, JSON.stringify(value));
        }
      },
      
      async deleteMany(keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
          if (store.delete(prefix + key)) count++;
        }
        return count;
      },
      
      async keys(pattern?: string): Promise<string[]> {
        const allKeys = Array.from(store.keys())
          .filter(k => k.startsWith(prefix))
          .map(k => k.slice(prefix.length));
        if (!pattern) return allKeys;
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return allKeys.filter(k => regex.test(k));
      },
      
      async clear(pattern?: string): Promise<void> {
        if (!pattern) {
          for (const key of store.keys()) {
            if (key.startsWith(prefix)) store.delete(key);
          }
        } else {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          for (const key of store.keys()) {
            if (key.startsWith(prefix) && regex.test(key.slice(prefix.length))) {
              store.delete(key);
            }
          }
        }
      },
      
      async connect(): Promise<void> {
        // Mock: already connected
      },
      
      async disconnect(): Promise<void> {
        // Mock: clear store on disconnect
        store.clear();
      },
      
      isConnected(): boolean {
        return true;
      }
    };
  }
};

// ================== Middleware Plugin Example ==================

/**
 * Example: Logging Middleware Plugin
 */
export const loggingMiddlewarePlugin: MiddlewarePlugin = {
  id: 'logging-middleware',
  name: 'Logging Middleware',
  version: '1.0.0',
  type: 'middleware',
  description: 'Logs all task and step executions',
  priority: 10, // Run early
  
  async beforeTask(task: string, context: MiddlewareContext) {
    context.logger.info(`Task started: ${task}`);
    context.data.set('startTime', Date.now());
    return task;
  },
  
  async afterTask(result: any, context: MiddlewareContext) {
    const duration = Date.now() - (context.data.get('startTime') || 0);
    context.logger.info(`Task completed in ${duration}ms`);
    return result;
  },
  
  async beforeStep(step: any, context: MiddlewareContext) {
    context.logger.debug(`Step starting: ${step.name}`);
    context.data.set(`step_${step.id}_start`, Date.now());
    return step;
  },
  
  async afterStep(step: any, result: any, context: MiddlewareContext) {
    const startKey = `step_${step.id}_start`;
    const duration = Date.now() - (context.data.get(startKey) || 0);
    context.logger.debug(`Step ${step.name} completed in ${duration}ms`);
    return result;
  },
  
  async onError(error: Error, context: MiddlewareContext) {
    context.logger.error(`Error occurred: ${error.message}`);
  }
};

/**
 * Example: Rate Limiting Middleware Plugin
 */
export const rateLimitMiddlewarePlugin: MiddlewarePlugin = {
  id: 'rate-limit-middleware',
  name: 'Rate Limit Middleware',
  version: '1.0.0',
  type: 'middleware',
  description: 'Rate limits task execution',
  priority: 5, // Run very early
  
  configSchema: {
    maxTasksPerMinute: {
      type: 'number',
      required: false,
      default: 60,
      description: 'Maximum tasks per minute'
    }
  },
  
  init(context: PluginContext) {
    // Initialize rate limit tracking
    (this as any)._taskTimes = [];
  },
  
  async beforeTask(task: string, context: MiddlewareContext) {
    const maxTasks = context.config.maxTasksPerMinute || 60;
    const taskTimes: number[] = (this as any)._taskTimes || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    const recentTasks = taskTimes.filter(t => t > oneMinuteAgo);
    (this as any)._taskTimes = recentTasks;
    
    if (recentTasks.length >= maxTasks) {
      throw new Error(`Rate limit exceeded: ${maxTasks} tasks/minute`);
    }
    
    recentTasks.push(now);
    return task;
  }
};

// ================== Extension Plugin Example ==================

/**
 * Example: Metrics Extension Plugin
 */
export const metricsExtensionPlugin: ExtensionPlugin = {
  id: 'metrics-extension',
  name: 'Metrics Extension',
  version: '1.0.0',
  type: 'extension',
  description: 'Adds metrics collection to agent',
  
  extend(agent: any) {
    // Add metrics object to agent
    agent.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalDuration: 0,
      stepCount: 0,
      
      getStats() {
        return {
          tasksCompleted: this.tasksCompleted,
          tasksFailed: this.tasksFailed,
          totalDuration: this.totalDuration,
          averageDuration: this.tasksCompleted > 0 
            ? this.totalDuration / this.tasksCompleted 
            : 0,
          stepCount: this.stepCount
        };
      },
      
      reset() {
        this.tasksCompleted = 0;
        this.tasksFailed = 0;
        this.totalDuration = 0;
        this.stepCount = 0;
      }
    };
    
    // Hook into events
    const originalRun = agent.run.bind(agent);
    agent.run = async function(task: string, context?: any) {
      const startTime = Date.now();
      try {
        const result = await originalRun(task, context);
        agent.metrics.tasksCompleted++;
        agent.metrics.totalDuration += Date.now() - startTime;
        agent.metrics.stepCount += result.steps?.length || 0;
        return result;
      } catch (error) {
        agent.metrics.tasksFailed++;
        throw error;
      }
    };
  }
};

// ================== Create Plugin Helper ==================

/**
 * Helper to create a tool plugin quickly
 */
export function createToolPlugin(
  id: string,
  name: string,
  tools: ToolDefinition[],
  options?: Partial<ToolPlugin>
): ToolPlugin {
  return {
    id,
    name,
    version: '1.0.0',
    type: 'tool',
    tools,
    ...options
  };
}

/**
 * Helper to create a middleware plugin quickly
 */
export function createMiddlewarePlugin(
  id: string,
  name: string,
  handlers: {
    beforeTask?: MiddlewarePlugin['beforeTask'];
    afterTask?: MiddlewarePlugin['afterTask'];
    beforeStep?: MiddlewarePlugin['beforeStep'];
    afterStep?: MiddlewarePlugin['afterStep'];
    onError?: MiddlewarePlugin['onError'];
  },
  options?: Partial<MiddlewarePlugin>
): MiddlewarePlugin {
  return {
    id,
    name,
    version: '1.0.0',
    type: 'middleware',
    ...handlers,
    ...options
  };
}
