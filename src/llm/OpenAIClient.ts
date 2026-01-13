// ============================================
// Agent Core - OpenAI Client
// ============================================

import {
  OpenAIConfig,
  OpenAICompletionOptions,
  OpenAIChatMessage,
  OpenAIResponse,
  ExtendedLLMClient,
  LLMUsage,
  LLMCallRecord
} from './types';
import { LLMMessage, LLMCompletionOptions } from '../types';
import { generateId } from '../utils';

export class OpenAIClient implements ExtendedLLMClient {
  readonly provider = 'openai' as const;
  
  private config: Required<OpenAIConfig>;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private callHistory: LLMCallRecord[] = [];
  
  // Model pricing (per 1K tokens) - approximate
  private readonly pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
  };

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      organization: config.organization || '',
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
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
    const requestId = generateId('oai');

    try {
      // Convert messages
      const openAIMessages = this.convertMessages(messages);
      
      // Build request body
      const body = this.buildRequestBody(openAIMessages, options);

      // Make request
      const response = await this.makeRequest('/chat/completions', body, options?.signal);

      // Parse response
      const data = response as OpenAIResponse;
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

  // -------------------- Request Building --------------------

  private convertMessages(messages: LLMMessage[]): OpenAIChatMessage[] {
    return messages.map(msg => ({
      role: msg.role as OpenAIChatMessage['role'],
      content: msg.content
    }));
  }

  private buildRequestBody(
    messages: OpenAIChatMessage[],
    options?: LLMCompletionOptions & OpenAICompletionOptions
  ): Record<string, any> {
    const body: Record<string, any> = {
      model: options?.model || this.config.model,
      messages,
      max_tokens: options?.maxTokens || this.config.defaultMaxTokens,
      temperature: options?.temperature ?? this.config.defaultTemperature
    };

    // Optional parameters
    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty;
    if (options?.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
    if (options?.stop) body.stop = options.stop;
    if (options?.user) body.user = options.user;
    if (options?.responseFormat) body.response_format = options.responseFormat;

    return body;
  }

  // -------------------- HTTP Request --------------------

  private async makeRequest(
    endpoint: string,
    body: Record<string, any>,
    signal?: AbortSignal
  ): Promise<any> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };

    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OpenAIError(
        error.error?.message || `Request failed: ${response.status}`,
        response.status,
        error.error?.type,
        error.error?.code
      );
    }

    return response.json();
  }

  // -------------------- Usage Tracking --------------------

  private trackUsage(usage: OpenAIResponse['usage'], model: string): void {
    this.usage.promptTokens += usage.prompt_tokens;
    this.usage.completionTokens += usage.completion_tokens;
    this.usage.totalTokens += usage.total_tokens;

    // Calculate cost
    const pricing = this.pricing[model] || this.pricing['gpt-4o-mini'];
    const cost = 
      (usage.prompt_tokens / 1000) * pricing.input +
      (usage.completion_tokens / 1000) * pricing.output;
    
    this.usage.estimatedCost = (this.usage.estimatedCost || 0) + cost;
  }

  private recordCall(
    id: string,
    model: string,
    startTime: number,
    usage?: OpenAIResponse['usage'],
    success: boolean = true,
    error?: any
  ): void {
    this.callHistory.push({
      id,
      provider: 'openai',
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
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }

  setTemperature(temp: number): void {
    this.config.defaultTemperature = Math.max(0, Math.min(2, temp));
  }

  setMaxTokens(tokens: number): void {
    this.config.defaultMaxTokens = Math.max(1, tokens);
  }

  // -------------------- Specialized Methods --------------------

  /**
   * Chat completion with JSON mode
   */
  async chatJSON<T = any>(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<T> {
    const result = await this.chat(messages, {
      ...options,
      responseFormat: { type: 'json_object' }
    } as any);

    try {
      return JSON.parse(result);
    } catch {
      throw new Error('Failed to parse JSON response');
    }
  }

  /**
   * Chat completion with system message
   */
  async chatWithSystem(
    systemPrompt: string,
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<string> {
    const allMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    return this.chat(allMessages, options);
  }

  /**
   * Stream chat completion (returns async generator)
   */
  async *chatStream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    const openAIMessages = this.convertMessages(messages);
    const body = {
      ...this.buildRequestBody(openAIMessages, options),
      stream: true
    };

    const url = `${this.config.baseURL}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
      },
      body: JSON.stringify(body),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new OpenAIError(`Stream request failed: ${response.status}`, response.status);
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

export class OpenAIError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'OpenAIError';
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

export function createOpenAIClient(config: OpenAIConfig): OpenAIClient {
  return new OpenAIClient(config);
}
