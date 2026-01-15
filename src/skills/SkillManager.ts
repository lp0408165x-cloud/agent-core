// ============================================
// Agent Core - Skill Manager
// ============================================

import type {
  Skill,
  SkillCategory,
  SkillStatus,
  SkillContext,
  SkillLogger,
  SkillManagerInterface,
  SkillRule,
} from './types';
import type { ToolDefinition } from '../types';

/**
 * Manages skill loading, activation, and execution
 */
export class SkillManager implements SkillManagerInterface {
  private skills: Map<string, Skill> = new Map();
  private status: Map<string, SkillStatus> = new Map();
  private configs: Map<string, Record<string, any>> = new Map();
  private activeSkills: Set<string> = new Set();

  constructor() {}

  /**
   * Load a skill
   */
  async load(skill: Skill, config: Record<string, any> = {}): Promise<void> {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill "${skill.id}" is already loaded`);
    }

    this.status.set(skill.id, 'loaded');
    
    try {
      // Store skill and config
      this.skills.set(skill.id, skill);
      this.configs.set(skill.id, config);

      // Initialize if needed
      if (skill.init) {
        const context = this.createContext(skill.id);
        await skill.init(context);
      }

      // Activate by default
      this.activeSkills.add(skill.id);
      this.status.set(skill.id, 'active');
      
      this.log('info', `Skill "${skill.name}" loaded successfully`);
    } catch (error) {
      this.status.set(skill.id, 'error');
      throw error;
    }
  }

  /**
   * Unload a skill
   */
  async unload(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill "${skillId}" is not loaded`);
    }

    try {
      if (skill.destroy) {
        await skill.destroy();
      }

      this.skills.delete(skillId);
      this.status.delete(skillId);
      this.configs.delete(skillId);
      this.activeSkills.delete(skillId);
      
      this.log('info', `Skill "${skill.name}" unloaded`);
    } catch (error) {
      this.log('error', `Failed to unload skill "${skillId}":`, error);
      throw error;
    }
  }

  /**
   * Get a skill by ID
   */
  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * Get all loaded skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillCategory): Skill[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Check if skill is loaded
   */
  has(id: string): boolean {
    return this.skills.has(id);
  }

  /**
   * Get skill status
   */
  getStatus(id: string): SkillStatus {
    return this.status.get(id) || 'unloaded';
  }

  /**
   * Activate a skill
   */
  activate(id: string): void {
    if (!this.skills.has(id)) {
      throw new Error(`Skill "${id}" is not loaded`);
    }
    this.activeSkills.add(id);
    this.status.set(id, 'active');
  }

  /**
   * Deactivate a skill
   */
  deactivate(id: string): void {
    this.activeSkills.delete(id);
    if (this.skills.has(id)) {
      this.status.set(id, 'loaded');
    }
  }

  /**
   * Get combined system prompt from all active skills
   */
  getSystemPrompt(): string {
    const prompts: string[] = [];
    
    for (const skillId of this.activeSkills) {
      const skill = this.skills.get(skillId);
      if (skill) {
        prompts.push(`## ${skill.name}\n\n${skill.systemPrompt}`);
      }
    }

    if (prompts.length === 0) {
      return '';
    }

    return `# Active Skills Knowledge\n\n${prompts.join('\n\n---\n\n')}`;
  }

  /**
   * Get all tools from active skills
   */
  getTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    
    for (const skillId of this.activeSkills) {
      const skill = this.skills.get(skillId);
      if (skill?.tools) {
        tools.push(...skill.tools);
      }
    }

    return tools;
  }

  /**
   * Get all rules from active skills
   */
  getRules(): SkillRule[] {
    const rules: SkillRule[] = [];
    
    for (const skillId of this.activeSkills) {
      const skill = this.skills.get(skillId);
      if (skill?.rules) {
        rules.push(...skill.rules);
      }
    }

    return rules;
  }

  /**
   * Run a skill template with variables
   */
  runTemplate(skillId: string, templateId: string, variables: Record<string, any>): string {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill "${skillId}" is not loaded`);
    }

    const template = skill.templates?.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found in skill "${skillId}"`);
    }

    // Replace variables in prompt
    let prompt = template.prompt;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Check for missing required variables
    const missingVars = template.variables
      ?.filter(v => v.required && !variables[v.name])
      .map(v => v.name);
    
    if (missingVars && missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    return prompt;
  }

  /**
   * Get active skill IDs
   */
  getActiveSkills(): string[] {
    return Array.from(this.activeSkills);
  }

  /**
   * Create context for skill initialization
   */
  private createContext(skillId: string): SkillContext {
    return {
      config: this.configs.get(skillId) || {},
      logger: this.createLogger(skillId),
      getSkill: (id: string) => this.get(id),
    };
  }

  /**
   * Create logger for a skill
   */
  private createLogger(skillId: string): SkillLogger {
    const prefix = `[Skill:${skillId}]`;
    return {
      debug: (msg, ...args) => console.debug(prefix, msg, ...args),
      info: (msg, ...args) => console.info(prefix, msg, ...args),
      warn: (msg, ...args) => console.warn(prefix, msg, ...args),
      error: (msg, ...args) => console.error(prefix, msg, ...args),
    };
  }

  /**
   * Internal logging
   */
  private log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const prefix = '[SkillManager]';
    switch (level) {
      case 'info':
        console.info(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'error':
        console.error(prefix, message, ...args);
        break;
    }
  }
}

/**
 * Create a new SkillManager instance
 */
export function createSkillManager(): SkillManager {
  return new SkillManager();
}