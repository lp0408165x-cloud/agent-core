// ============================================
// Agent Core - LLM Client Factory & Utilities
// ============================================

import {
  LLMClientConfig,
  LLMProvider,
  ExtendedLLMClient,
  RateLimitConfig,
  CacheConfig,
  LLMUsage
} from './types';
import { LLMClient, LLMMessage, LLMCompletionOptions } from '../types';
import { OpenAIClient, createOpenAIClient } from './OpenAIClient';
import { AnthropicClient, createAnthropicClient } from './AnthropicClient';
import { generateId, delay } from '../utils';

// -------------------- LLM Factory --------------------

export function createLLMClient(config: LLMClientConfig): ExtendedLLMClient {
  let client: ExtendedLLMClient;

  switch (config.provider) {
    case 'openai':
      if (!config.openai) {
        throw new Error('OpenAI config required');
      }
      client = createOpenAIClient(config.openai);
      break;

    case 'anthropic':
      if (!config.anthropic) {
        throw new Error('Anthropic config required');
      }
      client = createAnthropicClient(config.anthropic);
      break;

    case 'azure':
      if (!config.azure) {
        throw new Error('Azure config required');
      }
      // Azure uses OpenAI client with different base URL
      client = createOpenAIClient({
        apiKey: config.azure.apiKey,
        baseURL: `${config.azure.endpoint}/openai/deployments/${config.azure.deploymentName}`,
        model: config.azure.deploymentName,
        defaultMaxTokens: config.azure.defaultMaxTokens,
        defaultTemperature: config.azure.defaultTemperature
      });
      break;

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }

  // Wrap with rate limiter if configured
  if (config.rateLimit) {
    client = new RateLimitedClient(client, config.rateLimit);
  }

  // Wrap with cache if configured
  if (config.cache?.enabled) {
    client = new CachedClient(client, config.cache);
  }

  return client;
}

// -------------------- Rate Limited Client --------------------

export class RateLimitedClient implements ExtendedLLMClient {
  private client: ExtendedLLMClient;
  private config: Required<RateLimitConfig>;
  private requestQueue: Array<() => void> = [];
  private requestTimestamps: number[] = [];
  private tokenCount: number = 0;
  private lastMinuteStart: number = Date.now();

  constructor(client: ExtendedLLMClient, config: RateLimitConfig) {
    this.client = client;
    this.config = {
      requestsPerMinute: config.requestsPerMinute || 60,
      tokensPerMinute: config.tokensPerMinute || 100000,
      retryOnRateLimit: config.retryOnRateLimit ?? true,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    };
  }

  get provider() { return this.client.provider; }
  get model() { return this.client.model; }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    return this.withRateLimit(() => this.client.complete(prompt, options));
  }

  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    return this.withRateLimit(() => this.client.chat(messages, options));
  }

  private async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();

    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        this.recordRequest();
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if rate limited
        if (error.status === 429 && this.config.retryOnRateLimit) {
          const retryAfter = this.getRetryAfter(error);
          await delay(retryAfter || this.config.retryDelay * (attempt + 1));
          continue;
        }
        
        throw error;
      }
    }

    throw lastError;
  }

  private async waitForSlot(): Promise<void> {
    this.cleanOldTimestamps();

    // Check requests per minute
    while (this.requestTimestamps.length >= this.config.requestsPerMinute) {
      const waitTime = 60000 - (Date.now() - this.requestTimestamps[0]);
      if (waitTime > 0) {
        await delay(Math.min(waitTime, 1000));
        this.cleanOldTimestamps();
      }
    }
  }

  private cleanOldTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
  }

  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  private getRetryAfter(error: any): number | undefined {
    const retryAfter = error.headers?.get?.('retry-after');
    if (retryAfter) {
      return parseInt(retryAfter, 10) * 1000;
    }
    return undefined;
  }

  // Delegate other methods
  getUsage() { return this.client.getUsage(); }
  getCallHistory() { return this.client.getCallHistory(); }
  resetUsage() { this.client.resetUsage(); }
  setModel(model: string) { this.client.setModel(model); }
  getAvailableModels() { return this.client.getAvailableModels(); }
  setTemperature(temp: number) { this.client.setTemperature(temp); }
  setMaxTokens(tokens: number) { this.client.setMaxTokens(tokens); }
}

// -------------------- Cached Client --------------------

interface CacheEntry {
  response: string;
  timestamp: number;
  usage?: LLMUsage;
}

export class CachedClient implements ExtendedLLMClient {
  private client: ExtendedLLMClient;
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<CacheConfig>;

  constructor(client: ExtendedLLMClient, config: CacheConfig) {
    this.client = client;
    this.config = {
      enabled: config.enabled,
      ttl: config.ttl || 3600000,  // 1 hour default
      maxSize: config.maxSize || 1000
    };
  }

  get provider() { return this.client.provider; }
  get model() { return this.client.model; }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    const cacheKey = this.getCacheKey('complete', prompt, options);
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.client.complete(prompt, options);
    this.setCache(cacheKey, result);
    
    return result;
  }

  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    const cacheKey = this.getCacheKey('chat', JSON.stringify(messages), options);
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.client.chat(messages, options);
    this.setCache(cacheKey, result);
    
    return result;
  }

  private getCacheKey(method: string, input: string, options?: LLMCompletionOptions): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${this.client.model}:${method}:${input}:${optionsStr}`;
  }

  private getFromCache(key: string): string | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.response;
  }

  private setCache(key: string, response: string): void {
    // Enforce max size
    if (this.cache.size >= this.config.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits/misses
    };
  }

  // Delegate other methods
  getUsage() { return this.client.getUsage(); }
  getCallHistory() { return this.client.getCallHistory(); }
  resetUsage() { this.client.resetUsage(); }
  setModel(model: string) { this.client.setModel(model); }
  getAvailableModels() { return this.client.getAvailableModels(); }
  setTemperature(temp: number) { this.client.setTemperature(temp); }
  setMaxTokens(tokens: number) { this.client.setMaxTokens(tokens); }
}

// -------------------- Multi-Provider Client --------------------

export interface MultiProviderConfig {
  primary: ExtendedLLMClient;
  fallback?: ExtendedLLMClient;
  loadBalance?: ExtendedLLMClient[];
}

export class MultiProviderClient implements ExtendedLLMClient {
  private primary: ExtendedLLMClient;
  private fallback?: ExtendedLLMClient;
  private loadBalance: ExtendedLLMClient[];
  private currentIndex: number = 0;

  constructor(config: MultiProviderConfig) {
    this.primary = config.primary;
    this.fallback = config.fallback;
    this.loadBalance = config.loadBalance || [];
  }

  get provider() { return this.primary.provider; }
  get model() { return this.primary.model; }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    try {
      return await this.getNextClient().complete(prompt, options);
    } catch (error) {
      if (this.fallback) {
        return this.fallback.complete(prompt, options);
      }
      throw error;
    }
  }

  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    try {
      return await this.getNextClient().chat(messages, options);
    } catch (error) {
      if (this.fallback) {
        return this.fallback.chat(messages, options);
      }
      throw error;
    }
  }

  private getNextClient(): ExtendedLLMClient {
    if (this.loadBalance.length === 0) {
      return this.primary;
    }

    // Round-robin load balancing
    const client = this.loadBalance[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.loadBalance.length;
    return client;
  }

  // Aggregate usage from all clients
  getUsage(): LLMUsage {
    const usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    const clients = [this.primary, this.fallback, ...this.loadBalance].filter(Boolean);
    for (const client of clients) {
      const clientUsage = client!.getUsage();
      usage.promptTokens += clientUsage.promptTokens;
      usage.completionTokens += clientUsage.completionTokens;
      usage.totalTokens += clientUsage.totalTokens;
      usage.estimatedCost = (usage.estimatedCost || 0) + (clientUsage.estimatedCost || 0);
    }

    return usage;
  }

  getCallHistory() { return this.primary.getCallHistory(); }
  resetUsage() { 
    [this.primary, this.fallback, ...this.loadBalance]
      .filter(Boolean)
      .forEach(c => c!.resetUsage());
  }
  setModel(model: string) { this.primary.setModel(model); }
  getAvailableModels() { return this.primary.getAvailableModels(); }
  setTemperature(temp: number) { this.primary.setTemperature(temp); }
  setMaxTokens(tokens: number) { this.primary.setMaxTokens(tokens); }
}

// -------------------- Retry Wrapper --------------------

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryOn?: (error: any) => boolean;
}

export function withRetry<T extends LLMClient>(
  client: T,
  config: RetryConfig
): T {
  const retryOn = config.retryOn || ((error: any) => {
    return error.status === 429 || error.status >= 500;
  });

  const handler: ProxyHandler<T> = {
    get(target, prop) {
      const value = (target as any)[prop];
      
      if (typeof value === 'function' && (prop === 'complete' || prop === 'chat')) {
        return async (...args: any[]) => {
          let lastError: Error | undefined;
          
          for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
              return await value.apply(target, args);
            } catch (error) {
              lastError = error as Error;
              
              if (attempt < config.maxRetries && retryOn(error)) {
                await delay(config.retryDelay * Math.pow(2, attempt));
                continue;
              }
              
              throw error;
            }
          }
          
          throw lastError;
        };
      }
      
      return value;
    }
  };

  return new Proxy(client, handler);
}

// -------------------- Token Counter --------------------

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  // This is a simplification; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(messages: LLMMessage[]): number {
  let tokens = 0;
  
  for (const msg of messages) {
    // Add overhead for message structure
    tokens += 4;
    // Add content tokens
    tokens += estimateTokens(msg.content);
    // Add role tokens
    tokens += 1;
  }
  
  // Add response priming tokens
  tokens += 3;
  
  return tokens;
}
