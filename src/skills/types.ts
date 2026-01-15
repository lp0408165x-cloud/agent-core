// ============================================
// Agent Core - Skills System Types
// ============================================

import type { ToolDefinition } from '../types';

// -------------------- Skill Types --------------------

export type SkillCategory = 
  | 'compliance'    // 合规检查
  | 'analysis'      // 数据分析
  | 'document'      // 文档处理
  | 'coding'        // 代码开发
  | 'research'      // 研究调查
  | 'custom';       // 自定义

export type SkillStatus = 'unloaded' | 'loaded' | 'active' | 'error';

/**
 * Skill definition - domain knowledge + best practices
 */
export interface Skill {
  /** Unique skill identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Skill version */
  version: string;
  
  /** Category */
  category: SkillCategory;
  
  /** Description */
  description: string;
  
  /** Author */
  author?: string;
  
  /** System prompt - core knowledge */
  systemPrompt: string;
  
  /** Task templates */
  templates?: SkillTemplate[];
  
  /** Domain-specific tools */
  tools?: ToolDefinition[];
  
  /** Validation rules */
  rules?: SkillRule[];
  
  /** Example tasks */
  examples?: SkillExample[];
  
  /** Required configuration */
  configSchema?: SkillConfigSchema;
  
  /** Initialize skill */
  init?(context: SkillContext): Promise<void> | void;
  
  /** Cleanup */
  destroy?(): Promise<void> | void;
}

/**
 * Task template - pre-defined task patterns
 */
export interface SkillTemplate {
  /** Template ID */
  id: string;
  
  /** Template name */
  name: string;
  
  /** Description */
  description: string;
  
  /** Prompt template (supports {{variables}}) */
  prompt: string;
  
  /** Required variables */
  variables?: SkillVariable[];
  
  /** Expected output format */
  outputFormat?: 'text' | 'json' | 'markdown' | 'table';
}

/**
 * Template variable
 */
export interface SkillVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'array';
  required?: boolean;
  default?: any;
  description?: string;
}

/**
 * Validation rule
 */
export interface SkillRule {
  /** Rule ID */
  id: string;
  
  /** Rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Validation function or regex pattern */
  validate: ((value: any, context: RuleContext) => boolean | string) | string;
  
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  
  /** Error message template */
  message: string;
}

/**
 * Rule validation context
 */
export interface RuleContext {
  field: string;
  value: any;
  record: Record<string, any>;
  config: Record<string, any>;
}

/**
 * Example task for learning
 */
export interface SkillExample {
  /** Example title */
  title: string;
  
  /** Input/task */
  input: string;
  
  /** Expected output */
  output: string;
  
  /** Explanation */
  explanation?: string;
}

/**
 * Skill configuration schema
 */
export interface SkillConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    description?: string;
  };
}

/**
 * Skill context during execution
 */
export interface SkillContext {
  /** Current configuration */
  config: Record<string, any>;
  
  /** Logger */
  logger: SkillLogger;
  
  /** Get another skill */
  getSkill(id: string): Skill | undefined;
}

/**
 * Skill logger
 */
export interface SkillLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// -------------------- Skill Manager Interface --------------------

export interface SkillManagerInterface {
  /** Load a skill */
  load(skill: Skill, config?: Record<string, any>): Promise<void>;
  
  /** Unload a skill */
  unload(skillId: string): Promise<void>;
  
  /** Get a skill */
  get(id: string): Skill | undefined;
  
  /** Get all skills */
  getAll(): Skill[];
  
  /** Get skills by category */
  getByCategory(category: SkillCategory): Skill[];
  
  /** Check if skill is loaded */
  has(id: string): boolean;
  
  /** Get skill status */
  getStatus(id: string): SkillStatus;
  
  /** Get combined system prompt from active skills */
  getSystemPrompt(): string;
  
  /** Get all tools from active skills */
  getTools(): ToolDefinition[];
  
  /** Get all rules from active skills */
  getRules(): SkillRule[];
  
  /** Run a skill template */
  runTemplate(skillId: string, templateId: string, variables: Record<string, any>): string;
}

// -------------------- Type Guards --------------------

export function isSkill(obj: any): obj is Skill {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' &&
    typeof obj.systemPrompt === 'string';
}