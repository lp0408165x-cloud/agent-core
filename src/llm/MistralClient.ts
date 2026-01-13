// ============================================
// Agent Core - Mistral AI Client
// ============================================

import {
  ExtendedLLMClient,
  LLMUsage,
  LLMCallRecord
} from './types';
import { LLMMessage, LLMCompletionOptions } from '../types';
import { generateId } from '../utils';

// -------------------- Types --------------------

export interface MistralConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export interface MistralCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  randomSeed?: number;
  safePrompt?: boolean;
}

interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// -------------------- Client --------------------

export class MistralClient implements ExtendedLLMClient {
  readonly provider = 'mistral' as const;
  
  private config: Required<MistralConfig>;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private callHistory: LLMCallRecord[] = [];
  
  // Model pricing (per 1M tokens)
  private readonly pricing: Record<string, { input: number; output: number }> = {
    'mistral-large-latest': { input: 2, output: 6 },
    'mistral-medium-latest': { input: 2.7, output: 8.1 },
    'mistral-small-latest': { input: 0.2, output: 0.6 },
    'open-mistral-7b': { input: 0.25, output: 0.25 },
    'open-mixtral-8x7b': { input: 0.7, output: 0.7 },
    'open-mixtral-8x22b': { input: 2, output: 6 },
    'codestral-latest': { input: 0.2, output: 0.6 }
  };

  constructor(config: MistralConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.mistral.ai/v1',
      model: config.model || 'mistral-small-latest',
      defaultMaxTokens: config.defaultMaxTokens || 4096,
      defaultTemperature: config.defaultTemperature || 0.7
    };
  }

  get model(): string {
    return this.config.model;
  }

  // -------------------- Main API Methods --------------------

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
    return this.chat(messages, options);
  }

  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    const startTime = Date.now();
    const requestId = generateId('mis');

    try {
      // Convert messages
      const mistralMessages = this.convertMessages(messages);
      
      // Build request body
      const body = this.buildRequestBody(mistralMessages, options);

      // Make request
      const response = await this.makeRequest('/chat/completions', body, options?.signal);

      // Parse response
      const data = response as MistralResponse;
      const content = data.choices[0]?.message?.content || '';

      // Track usage
      if (data.usage) {
        this.trackUsage(data.usage, data.model);
      }

      // Record call
      this.recordCall(requestId, data.model, startTime, data.usage, true);

      return content;

    } catch (error) {
      this.recordCall(requestId, this.config.model, startTime, undefined, false, error);
      throw error;
    }
  }

  // -------------------- Message Conversion --------------------

  private convertMessages(messages: LLMMessage[]): MistralMessage[] {
    return messages.map(msg => ({
      role: msg.role as MistralMessage['role'],
      content: msg.content
    }));
  }

  private buildRequestBody(
    messages: MistralMessage[],
    options?: LLMCompletionOptions & MistralCompletionOptions
  ): Record<string, any> {
    const body: Record<string, any> = {
      model: options?.model || this.config.model,
      messages,
      max_tokens: options?.maxTokens || this.config.defaultMaxTokens,
      temperature: options?.temperature ?? this.config.defaultTemperature
    };

    // Optional parameters
    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.randomSeed !== undefined) body.random_seed = options.randomSeed;
    if (options?.safePrompt !== undefined) body.safe_prompt = options.safePrompt;

    return body;
  }

  // -------------------- HTTP Request --------------------

  private async makeRequest(
    endpoint: string,
    body: Record<string, any>,
    signal?: AbortSignal
  ): Promise<any> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new MistralError(
        error.message || `Request failed: ${response.status}`,
        response.status,
        error.type
      );
    }

    return response.json();
  }

  // -------------------- Usage Tracking --------------------

  private trackUsage(usage: MistralResponse['usage'], model: string): void {
    this.usage.promptTokens += usage.prompt_tokens;
    this.usage.completionTokens += usage.completion_tokens;
    this.usage.totalTokens += usage.total_tokens;

    // Calculate cost (pricing is per 1M tokens)
    const pricing = this.pricing[model] || this.pricing['mistral-small-latest'];
    const cost = 
      (usage.prompt_tokens / 1000000) * pricing.input +
      (usage.completion_tokens / 1000000) * pricing.output;
    
    this.usage.estimatedCost = (this.usage.estimatedCost || 0) + cost;
  }

  private recordCall(
    id: string,
    model: string,
    startTime: number,
    usage?: MistralResponse['usage'],
    success: boolean = true,
    error?: any
  ): void {
    this.callHistory.push({
      id,
      provider: 'mistral' as any,
      model,
      timestamp: startTime,
      duration: Date.now() - startTime,
      usage: usage ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      } : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      success,
      error: error?.message
    });
  }

  // -------------------- ExtendedLLMClient Implementation --------------------

  getUsage(): LLMUsage {
    return { ...this.usage };
  }

  getCallHistory(): LLMCallRecord[] {
    return [...this.callHistory];
  }

  resetUsage(): void {
    this.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.callHistory = [];
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  getAvailableModels(): string[] {
    return [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'open-mistral-7b',
      'open-mixtral-8x7b',
      'open-mixtral-8x22b',
      'codestral-latest'
    ];
  }

  setTemperature(temp: number): void {
    this.config.defaultTemperature = Math.max(0, Math.min(1, temp));
  }

  setMaxTokens(tokens: number): void {
    this.config.defaultMaxTokens = Math.max(1, tokens);
  }

  // -------------------- Specialized Methods --------------------

  /**
   * Chat with JSON output
   */
  async chatJSON<T = any>(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<T> {
    const jsonMessages = [...messages];
    if (jsonMessages.length > 0) {
      const lastMsg = jsonMessages[jsonMessages.length - 1];
      jsonMessages[jsonMessages.length - 1] = {
        ...lastMsg,
        content: lastMsg.content + '\n\nRespond with valid JSON only.'
      };
    }

    const result = await this.chat(jsonMessages, options);

    const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse JSON response');
    }
  }

  /**
   * Stream chat completion
   */
  async *chatStream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    const mistralMessages = this.convertMessages(messages);
    const body = {
      ...this.buildRequestBody(mistralMessages, options),
      stream: true
    };

    const url = `${this.config.baseURL}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new MistralError(`Stream request failed: ${response.status}`, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// -------------------- Error Class --------------------

export class MistralError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string
  ) {
    super(message);
    this.name = 'MistralError';
  }

  isRateLimit(): boolean {
    return this.status === 429;
  }

  isAuthError(): boolean {
    return this.status === 401;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

// -------------------- Factory --------------------

export function createMistralClient(config: MistralConfig): MistralClient {
  return new MistralClient(config);
}
