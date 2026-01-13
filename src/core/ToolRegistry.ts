// ============================================
// Agent Core - Tool Registry
// ============================================

import {
  ToolDefinition,
  ToolParameter,
  ToolExecuteOptions,
  LLMClient
} from '../types';
import { EventEmitter, validateParams } from '../utils';

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private llm: LLMClient | null = null;
  private categories: Map<string, Set<string>> = new Map();

  // -------------------- Tool Management --------------------

  public register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
    }

    // Validate tool definition
    this.validateToolDefinition(tool);

    this.tools.set(tool.name, tool);

    // Update category index
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)!.add(tool.name);

    this.emit('tool:registered', { name: tool.name, category: tool.category });
  }

  public registerMany(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.register(tool));
  }

  public unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    this.tools.delete(name);
    this.categories.get(tool.category)?.delete(name);

    this.emit('tool:unregistered', { name });
    return true;
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  public getToolsByCategory(category: string): ToolDefinition[] {
    const names = this.categories.get(category);
    if (!names) return [];
    return Array.from(names).map(name => this.tools.get(name)!);
  }

  public getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  // -------------------- Tool Validation --------------------

  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool "${tool.name}" must have a description`);
    }

    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error(`Tool "${tool.name}" must have an execute function`);
    }

    if (!Array.isArray(tool.parameters)) {
      throw new Error(`Tool "${tool.name}" must have a parameters array`);
    }

    // Validate parameters
    tool.parameters.forEach((param, index) => {
      if (!param.name) {
        throw new Error(`Tool "${tool.name}" parameter ${index} must have a name`);
      }
      if (!param.type) {
        throw new Error(`Tool "${tool.name}" parameter "${param.name}" must have a type`);
      }
    });
  }

  // -------------------- Tool Execution --------------------

  public async executeTool(
    name: string,
    params: Record<string, any>,
    options?: ToolExecuteOptions
  ): Promise<any> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate parameters
    const validation = validateParams(params, tool.parameters);
    if (!validation.valid) {
      throw new Error(`Invalid parameters for tool "${name}": ${validation.errors.join(', ')}`);
    }

    // Apply defaults
    const paramsWithDefaults = this.applyDefaults(params, tool.parameters);

    this.emit('tool:execute:start', { name, params: paramsWithDefaults });

    try {
      const result = await tool.execute(paramsWithDefaults, options);
      this.emit('tool:execute:success', { name, result });
      return result;
    } catch (error) {
      this.emit('tool:execute:error', { name, error });
      throw error;
    }
  }

  private applyDefaults(
    params: Record<string, any>,
    schema: ToolParameter[]
  ): Record<string, any> {
    const result = { ...params };

    schema.forEach(param => {
      if (result[param.name] === undefined && param.default !== undefined) {
        result[param.name] = param.default;
      }
    });

    return result;
  }

  // -------------------- LLM Management --------------------

  public setLLM(llm: LLMClient): void {
    this.llm = llm;
    this.emit('llm:set', {});
  }

  public getLLM(): LLMClient {
    if (!this.llm) {
      throw new Error('LLM client not configured');
    }
    return this.llm;
  }

  public hasLLM(): boolean {
    return this.llm !== null;
  }

  // -------------------- Tool Description for LLM --------------------

  public getToolDescriptions(): string {
    const tools = this.getAvailableTools();
    
    return tools.map(tool => {
      const params = tool.parameters
        .map(p => `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`)
        .join('\n');

      return `
Tool: ${tool.name}
Category: ${tool.category}
Description: ${tool.description}
Parameters:
${params}
Returns: ${tool.returns}
`.trim();
    }).join('\n\n---\n\n');
  }

  public getToolSchema(): object[] {
    return this.getAvailableTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map(p => [
            p.name,
            {
              type: p.type,
              description: p.description,
              default: p.default
            }
          ])
        ),
        required: tool.parameters
          .filter(p => p.required)
          .map(p => p.name)
      }
    }));
  }

  // -------------------- Serialization --------------------

  public serialize(): string {
    const toolData = Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      returns: tool.returns
      // Note: execute function cannot be serialized
    }));

    return JSON.stringify(toolData);
  }
}

// -------------------- Tool Builder Helper --------------------

export class ToolBuilder {
  private tool: Partial<ToolDefinition> = {
    parameters: []
  };

  name(name: string): this {
    this.tool.name = name;
    return this;
  }

  description(description: string): this {
    this.tool.description = description;
    return this;
  }

  category(category: string): this {
    this.tool.category = category;
    return this;
  }

  parameter(param: ToolParameter): this {
    this.tool.parameters!.push(param);
    return this;
  }

  returns(returnType: string): this {
    this.tool.returns = returnType;
    return this;
  }

  execute(fn: ToolDefinition['execute']): this {
    this.tool.execute = fn;
    return this;
  }

  build(): ToolDefinition {
    if (!this.tool.name) throw new Error('Tool name is required');
    if (!this.tool.description) throw new Error('Tool description is required');
    if (!this.tool.execute) throw new Error('Tool execute function is required');

    return {
      name: this.tool.name,
      description: this.tool.description,
      category: this.tool.category || 'general',
      parameters: this.tool.parameters || [],
      returns: this.tool.returns || 'any',
      execute: this.tool.execute
    };
  }
}

export function createTool(): ToolBuilder {
  return new ToolBuilder();
}
