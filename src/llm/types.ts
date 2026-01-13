// ============================================
// Agent Core - LLM Client Types
// ============================================

import type { LLMClient } from '../types';

// -------------------- Provider Types --------------------

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'ollama' | 'azure' | 'custom';

// -------------------- OpenAI Types --------------------

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export interface OpenAICompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  user?: string;
  responseFormat?: { type: 'text' | 'json_object' };
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// -------------------- Anthropic Types --------------------

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
  anthropicVersion?: string;
}

export interface AnthropicCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  system?: string;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// -------------------- Azure OpenAI Types --------------------

export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

// -------------------- Usage Tracking --------------------

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

export interface LLMCallRecord {
  id: string;
  provider: LLMProvider;
  model: string;
  timestamp: number;
  duration: number;
  usage: LLMUsage;
  success: boolean;
  error?: string;
}

// -------------------- Extended LLM Client --------------------

export interface ExtendedLLMClient extends LLMClient {
  provider: LLMProvider;
  model: string;
  
  // Usage tracking
  getUsage(): LLMUsage;
  getCallHistory(): LLMCallRecord[];
  resetUsage(): void;
  
  // Model management
  setModel(model: string): void;
  getAvailableModels(): string[];
  
  // Configuration
  setTemperature(temp: number): void;
  setMaxTokens(tokens: number): void;
}

// -------------------- Rate Limiting --------------------

export interface RateLimitConfig {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  retryOnRateLimit?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// -------------------- Caching --------------------

export interface CacheConfig {
  enabled: boolean;
  ttl?: number;  // Time to live in ms
  maxSize?: number;  // Max cache entries
}

// -------------------- Factory Config --------------------

export interface LLMClientConfig {
  provider: LLMProvider;
  openai?: OpenAIConfig;
  anthropic?: AnthropicConfig;
  azure?: AzureOpenAIConfig;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  timeout?: number;
  retries?: number;
}
