// ============================================
// Agent Core - Google Gemini Client
// ============================================

import {
  ExtendedLLMClient,
  LLMUsage,
  LLMCallRecord
} from './types';
import { LLMMessage, LLMCompletionOptions } from '../types';
import { generateId } from '../utils';

// -------------------- Types --------------------

export interface GeminiConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export interface GeminiCompletionOptions {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  safetySettings?: GeminiSafetySetting[];
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// -------------------- Client --------------------

export class GeminiClient implements ExtendedLLMClient {
  readonly provider = 'gemini' as const;
  
  private config: Required<GeminiConfig>;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private callHistory: LLMCallRecord[] = [];
  
  // Model pricing (per 1K tokens) - approximate
  private readonly pricing: Record<string, { input: number; output: number }> = {
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-1.0-pro': { input: 0.0005, output: 0.0015 },
    'gemini-pro': { input: 0.0005, output: 0.0015 }
  };

  constructor(config: GeminiConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://generativelanguage.googleapis.com/v1beta',
      model: config.model || 'gemini-1.5-flash',
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
    const requestId = generateId('gem');

    try {
      // Convert messages
      const geminiContents = this.convertMessages(messages);
      
      // Build request body
      const body = this.buildRequestBody(geminiContents, options);

      // Get model
      const modelName = (options as GeminiCompletionOptions)?.model || this.config.model;
      
      // Make request
      const response = await this.makeRequest(modelName, body, options?.signal);

      // Parse response
      const data = response as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Track usage
      if (data.usageMetadata) {
        this.trackUsage(data.usageMetadata, modelName);
      }

      // Record call
      this.recordCall(requestId, modelName, startTime, data.usageMetadata, true);

      return content;

    } catch (error) {
      this.recordCall(requestId, this.config.model, startTime, undefined, false, error);
      throw error;
    }
  }

  // -------------------- Message Conversion --------------------

  private convertMessages(messages: LLMMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini doesn't have system role, prepend to first user message
        systemPrompt += msg.content + '\n\n';
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        
        // If we have a system prompt, prepend it to the first user message
        let content = msg.content;
        if (systemPrompt && role === 'user') {
          content = systemPrompt + content;
          systemPrompt = '';
        }
        
        contents.push({
          role,
          parts: [{ text: content }]
        });
      }
    }

    return contents;
  }

  private buildRequestBody(
    contents: GeminiContent[],
    options?: LLMCompletionOptions & GeminiCompletionOptions
  ): Record<string, any> {
    const body: Record<string, any> = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxOutputTokens || options?.maxTokens || this.config.defaultMaxTokens,
        temperature: options?.temperature ?? this.config.defaultTemperature
      }
    };

    // Optional parameters
    if (options?.topP !== undefined) {
      body.generationConfig.topP = options.topP;
    }
    if (options?.topK !== undefined) {
      body.generationConfig.topK = options.topK;
    }
    if (options?.stopSequences) {
      body.generationConfig.stopSequences = options.stopSequences;
    }
    if (options?.safetySettings) {
      body.safetySettings = options.safetySettings;
    }

    return body;
  }

  // -------------------- HTTP Request --------------------

  private async makeRequest(
    model: string,
    body: Record<string, any>,
    signal?: AbortSignal
  ): Promise<any> {
    const url = `${this.config.baseURL}/models/${model}:generateContent?key=${this.config.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new GeminiError(
        error.error?.message || `Request failed: ${response.status}`,
        response.status,
        error.error?.code
      );
    }

    return response.json();
  }

  // -------------------- Usage Tracking --------------------

  private trackUsage(usage: GeminiResponse['usageMetadata'], model: string): void {
    if (!usage) return;
    
    this.usage.promptTokens += usage.promptTokenCount;
    this.usage.completionTokens += usage.candidatesTokenCount;
    this.usage.totalTokens += usage.totalTokenCount;

    // Calculate cost
    const pricing = this.pricing[model] || this.pricing['gemini-1.5-flash'];
    const cost = 
      (usage.promptTokenCount / 1000) * pricing.input +
      (usage.candidatesTokenCount / 1000) * pricing.output;
    
    this.usage.estimatedCost = (this.usage.estimatedCost || 0) + cost;
  }

  private recordCall(
    id: string,
    model: string,
    startTime: number,
    usage?: GeminiResponse['usageMetadata'],
    success: boolean = true,
    error?: any
  ): void {
    this.callHistory.push({
      id,
      provider: 'gemini' as any,
      model,
      timestamp: startTime,
      duration: Date.now() - startTime,
      usage: usage ? {
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount
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
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro'
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
   * Chat with JSON output
   */
  async chatJSON<T = any>(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<T> {
    // Add instruction to output JSON
    const jsonMessages = [...messages];
    if (jsonMessages.length > 0) {
      const lastMsg = jsonMessages[jsonMessages.length - 1];
      jsonMessages[jsonMessages.length - 1] = {
        ...lastMsg,
        content: lastMsg.content + '\n\nRespond with valid JSON only, no markdown.'
      };
    }

    const result = await this.chat(jsonMessages, options);

    // Extract JSON from response
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
    const geminiContents = this.convertMessages(messages);
    const body = this.buildRequestBody(geminiContents, options);
    const modelName = (options as GeminiCompletionOptions)?.model || this.config.model;
    
    const url = `${this.config.baseURL}/models/${modelName}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new GeminiError(`Stream request failed: ${response.status}`, response.status);
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
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// -------------------- Error Class --------------------

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'GeminiError';
  }

  isRateLimit(): boolean {
    return this.status === 429;
  }

  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

// -------------------- Factory --------------------

export function createGeminiClient(config: GeminiConfig): GeminiClient {
  return new GeminiClient(config);
}
