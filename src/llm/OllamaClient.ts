// ============================================
// Agent Core - Ollama Client (Local LLM)
// ============================================

import {
  ExtendedLLMClient,
  LLMUsage,
  LLMCallRecord
} from './types';
import { LLMMessage, LLMCompletionOptions } from '../types';
import { generateId } from '../utils';

// -------------------- Types --------------------

export interface OllamaConfig {
  baseURL?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
  keepAlive?: string;  // e.g., "5m", "1h"
}

export interface OllamaCompletionOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  numPredict?: number;  // max tokens
  stop?: string[];
  seed?: number;
  numCtx?: number;      // context window size
  repeatPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

// -------------------- Client --------------------

export class OllamaClient implements ExtendedLLMClient {
  readonly provider = 'ollama' as const;
  
  private config: Required<OllamaConfig>;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private callHistory: LLMCallRecord[] = [];
  private cachedModels: string[] = [];

  constructor(config: OllamaConfig = {}) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:11434',
      model: config.model || 'llama3.2',
      defaultMaxTokens: config.defaultMaxTokens || 4096,
      defaultTemperature: config.defaultTemperature || 0.7,
      keepAlive: config.keepAlive || '5m'
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
    const requestId = generateId('oll');

    try {
      // Convert messages
      const ollamaMessages = this.convertMessages(messages);
      
      // Build request body
      const body = this.buildRequestBody(ollamaMessages, options);

      // Make request
      const response = await this.makeRequest('/api/chat', body, options?.signal);

      // Parse response
      const data = response as OllamaResponse;
      const content = data.message?.content || '';

      // Track usage
      this.trackUsage(data);

      // Record call
      this.recordCall(requestId, data.model, startTime, data, true);

      return content;

    } catch (error) {
      this.recordCall(requestId, this.config.model, startTime, undefined, false, error);
      throw error;
    }
  }

  // -------------------- Message Conversion --------------------

  private convertMessages(messages: LLMMessage[]): OllamaMessage[] {
    return messages.map(msg => ({
      role: msg.role as OllamaMessage['role'],
      content: msg.content
    }));
  }

  private buildRequestBody(
    messages: OllamaMessage[],
    options?: LLMCompletionOptions & OllamaCompletionOptions
  ): Record<string, any> {
    const body: Record<string, any> = {
      model: options?.model || this.config.model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? this.config.defaultTemperature,
        num_predict: options?.numPredict || options?.maxTokens || this.config.defaultMaxTokens
      }
    };

    // Optional parameters
    if (options?.topP !== undefined) body.options.top_p = options.topP;
    if (options?.topK !== undefined) body.options.top_k = options.topK;
    if (options?.stop) body.options.stop = options.stop;
    if (options?.seed !== undefined) body.options.seed = options.seed;
    if (options?.numCtx !== undefined) body.options.num_ctx = options.numCtx;
    if (options?.repeatPenalty !== undefined) body.options.repeat_penalty = options.repeatPenalty;
    if (options?.presencePenalty !== undefined) body.options.presence_penalty = options.presencePenalty;
    if (options?.frequencyPenalty !== undefined) body.options.frequency_penalty = options.frequencyPenalty;

    // Keep alive
    body.keep_alive = this.config.keepAlive;

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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new OllamaError(
        error || `Request failed: ${response.status}`,
        response.status
      );
    }

    return response.json();
  }

  // -------------------- Usage Tracking --------------------

  private trackUsage(response: OllamaResponse): void {
    const promptTokens = response.prompt_eval_count || 0;
    const completionTokens = response.eval_count || 0;
    
    this.usage.promptTokens += promptTokens;
    this.usage.completionTokens += completionTokens;
    this.usage.totalTokens += promptTokens + completionTokens;

    // Ollama is free (local), so no cost
    this.usage.estimatedCost = 0;
  }

  private recordCall(
    id: string,
    model: string,
    startTime: number,
    response?: OllamaResponse,
    success: boolean = true,
    error?: any
  ): void {
    this.callHistory.push({
      id,
      provider: 'ollama' as any,
      model,
      timestamp: startTime,
      duration: Date.now() - startTime,
      usage: response ? {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
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
    // Return cached models or common defaults
    if (this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    return [
      'llama3.2',
      'llama3.1',
      'llama3',
      'llama2',
      'mistral',
      'mixtral',
      'codellama',
      'phi3',
      'gemma2',
      'qwen2.5',
      'deepseek-coder'
    ];
  }

  setTemperature(temp: number): void {
    this.config.defaultTemperature = Math.max(0, Math.min(2, temp));
  }

  setMaxTokens(tokens: number): void {
    this.config.defaultMaxTokens = Math.max(1, tokens);
  }

  // -------------------- Ollama-Specific Methods --------------------

  /**
   * List locally available models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await fetch(`${this.config.baseURL}/api/tags`);
    if (!response.ok) {
      throw new OllamaError(`Failed to list models: ${response.status}`, response.status);
    }
    const data = await response.json();
    this.cachedModels = data.models?.map((m: OllamaModelInfo) => m.name) || [];
    return data.models || [];
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!response.ok) {
      throw new OllamaError(`Failed to pull model: ${response.status}`, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (onProgress && data.status) {
              onProgress(data.status);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Delete a local model
   */
  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) {
      throw new OllamaError(`Failed to delete model: ${response.status}`, response.status);
    }
  }

  /**
   * Check if Ollama server is running
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate embeddings
   */
  async embed(text: string, model?: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseURL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || this.config.model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new OllamaError(`Failed to generate embeddings: ${response.status}`, response.status);
    }

    const data = await response.json();
    return data.embedding || [];
  }

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
        content: lastMsg.content + '\n\nRespond with valid JSON only, no explanation.'
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
    const ollamaMessages = this.convertMessages(messages);
    const body = {
      ...this.buildRequestBody(ollamaMessages, options),
      stream: true
    };

    const url = `${this.config.baseURL}/api/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new OllamaError(`Stream request failed: ${response.status}`, response.status);
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
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content;
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

export class OllamaError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'OllamaError';
  }

  isConnectionError(): boolean {
    return this.status === 0 || this.message.includes('fetch');
  }

  isModelNotFound(): boolean {
    return this.status === 404;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

// -------------------- Factory --------------------

export function createOllamaClient(config?: OllamaConfig): OllamaClient {
  return new OllamaClient(config);
}
