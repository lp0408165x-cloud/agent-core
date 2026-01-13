// ============================================
// Agent Core - Anthropic Client
// ============================================

import {
  AnthropicConfig,
  AnthropicCompletionOptions,
  AnthropicMessage,
  AnthropicResponse,
  ExtendedLLMClient,
  LLMUsage,
  LLMCallRecord
} from './types';
import { LLMMessage, LLMCompletionOptions } from '../types';
import { generateId } from '../utils';

export class AnthropicClient implements ExtendedLLMClient {
  readonly provider = 'anthropic' as const;
  
  private config: Required<AnthropicConfig>;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private callHistory: LLMCallRecord[] = [];
  
  // Model pricing (per 1M tokens)
  private readonly pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-3-5-haiku-20241022': { input: 1, output: 5 },
    'claude-3-opus-20240229': { input: 15, output: 75 },
    'claude-3-sonnet-20240229': { input: 3, output: 15 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
  };

  constructor(config: AnthropicConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.anthropic.com/v1',
      model: config.model || 'claude-3-5-sonnet-20241022',
      defaultMaxTokens: config.defaultMaxTokens || 4096,
      defaultTemperature: config.defaultTemperature || 0.7,
      anthropicVersion: config.anthropicVersion || '2023-06-01'
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
    const requestId = generateId('ant');

    try {
      // Extract system message if present
      const { systemPrompt, anthropicMessages } = this.convertMessages(messages);
      
      // Build request body
      const body = this.buildRequestBody(anthropicMessages, systemPrompt, options);

      // Make request
      const response = await this.makeRequest('/messages', body, options?.signal);

      // Parse response
      const data = response as AnthropicResponse;
      const content = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

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

  private convertMessages(messages: LLMMessage[]): {
    systemPrompt: string | undefined;
    anthropicMessages: AnthropicMessage[];
  } {
    let systemPrompt: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    // Anthropic requires alternating user/assistant messages
    // Ensure first message is from user
    if (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({ role: 'user', content: '' });
    }

    return { systemPrompt, anthropicMessages };
  }

  private buildRequestBody(
    messages: AnthropicMessage[],
    systemPrompt: string | undefined,
    options?: LLMCompletionOptions & AnthropicCompletionOptions
  ): Record<string, any> {
    const body: Record<string, any> = {
      model: options?.model || this.config.model,
      messages,
      max_tokens: options?.maxTokens || this.config.defaultMaxTokens
    };

    // System prompt
    if (systemPrompt || options?.system) {
      body.system = options?.system || systemPrompt;
    }

    // Optional parameters
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    } else if (this.config.defaultTemperature !== undefined) {
      body.temperature = this.config.defaultTemperature;
    }

    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.topK !== undefined) body.top_k = options.topK;
    if (options?.stopSequences) body.stop_sequences = options.stopSequences;

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
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.config.anthropicVersion
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new AnthropicError(
        error.error?.message || `Request failed: ${response.status}`,
        response.status,
        error.error?.type
      );
    }

    return response.json();
  }

  // -------------------- Usage Tracking --------------------

  private trackUsage(usage: AnthropicResponse['usage'], model: string): void {
    this.usage.promptTokens += usage.input_tokens;
    this.usage.completionTokens += usage.output_tokens;
    this.usage.totalTokens += usage.input_tokens + usage.output_tokens;

    // Calculate cost (pricing is per 1M tokens)
    const pricing = this.pricing[model] || this.pricing['claude-3-5-sonnet-20241022'];
    const cost = 
      (usage.input_tokens / 1000000) * pricing.input +
      (usage.output_tokens / 1000000) * pricing.output;
    
    this.usage.estimatedCost = (this.usage.estimatedCost || 0) + cost;
  }

  private recordCall(
    id: string,
    model: string,
    startTime: number,
    usage?: AnthropicResponse['usage'],
    success: boolean = true,
    error?: any
  ): void {
    this.callHistory.push({
      id,
      provider: 'anthropic',
      model,
      timestamp: startTime,
      duration: Date.now() - startTime,
      usage: usage ? {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens
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
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
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
   * Chat completion expecting JSON response
   */
  async chatJSON<T = any>(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<T> {
    // Add instruction for JSON output
    const jsonMessages: LLMMessage[] = [
      ...messages.slice(0, -1),
      {
        role: messages[messages.length - 1].role,
        content: `${messages[messages.length - 1].content}\n\nRespond with valid JSON only, no additional text.`
      }
    ];

    const result = await this.chat(jsonMessages, options);

    // Try to extract JSON from response
    try {
      // Try direct parse first
      return JSON.parse(result);
    } catch {
      // Try to find JSON in response
      const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
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
   * Stream chat completion
   */
  async *chatStream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    const { systemPrompt, anthropicMessages } = this.convertMessages(messages);
    const body = {
      ...this.buildRequestBody(anthropicMessages, systemPrompt, options),
      stream: true
    };

    const url = `${this.config.baseURL}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.anthropicVersion
      },
      body: JSON.stringify(body),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new AnthropicError(`Stream request failed: ${response.status}`, response.status);
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
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta') {
              const text = parsed.delta?.text;
              if (text) yield text;
            }
            
            if (parsed.type === 'message_stop') {
              return;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Vision: Chat with image
   */
  async chatWithImage(
    textPrompt: string,
    imageBase64: string,
    mediaType: string = 'image/png',
    options?: LLMCompletionOptions
  ): Promise<string> {
    const messages: AnthropicMessage[] = [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64
          }
        },
        {
          type: 'text',
          text: textPrompt
        }
      ]
    }];

    const body = this.buildRequestBody(messages, undefined, options);
    const response = await this.makeRequest('/messages', body, options?.signal);
    
    const data = response as AnthropicResponse;
    return data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }
}

// -------------------- Error Class --------------------

export class AnthropicError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string
  ) {
    super(message);
    this.name = 'AnthropicError';
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

  isOverloaded(): boolean {
    return this.status === 529;
  }
}

// -------------------- Factory --------------------

export function createAnthropicClient(config: AnthropicConfig): AnthropicClient {
  return new AnthropicClient(config);
}
