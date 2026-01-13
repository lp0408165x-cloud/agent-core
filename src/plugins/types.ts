// ============================================
// Agent Core - Plugin System Types
// ============================================

import type { ToolDefinition, LLMClient } from '../types';
import type { StorageAdapter } from '../persistence/types';

// -------------------- Plugin Types --------------------

export type PluginType = 'tool' | 'llm' | 'storage' | 'middleware' | 'extension';

export type PluginStatus = 'unloaded' | 'loading' | 'active' | 'error' | 'disabled';

/**
 * Base plugin interface
 */
export interface Plugin {
  /** Unique plugin identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Plugin version (semver) */
  version: string;
  
  /** Plugin type */
  type: PluginType;
  
  /** Description */
  description?: string;
  
  /** Author */
  author?: string;
  
  /** Homepage/repository URL */
  homepage?: string;
  
  /** Required dependencies (plugin IDs) */
  dependencies?: string[];
  
  /** Minimum agent-core version */
  agentCoreVersion?: string;
  
  /** Plugin configuration schema */
  configSchema?: PluginConfigSchema;
  
  /** Initialize plugin */
  init?(context: PluginContext): Promise<void> | void;
  
  /** Cleanup on unload */
  destroy?(): Promise<void> | void;
}

/**
 * Tool plugin - provides additional tools
 */
export interface ToolPlugin extends Plugin {
  type: 'tool';
  
  /** Tools provided by this plugin */
  tools: ToolDefinition[];
}

/**
 * LLM plugin - provides LLM client
 */
export interface LLMPlugin extends Plugin {
  type: 'llm';
  
  /** Provider name */
  provider: string;
  
  /** Create LLM client */
  createClient(config: Record<string, any>): LLMClient;
  
  /** Default configuration */
  defaultConfig?: Record<string, any>;
}

/**
 * Storage plugin - provides storage adapter
 */
export interface StoragePlugin extends Plugin {
  type: 'storage';
  
  /** Storage type name */
  storageType: string;
  
  /** Create storage adapter */
  createAdapter(config: Record<string, any>): StorageAdapter;
  
  /** Default configuration */
  defaultConfig?: Record<string, any>;
}

/**
 * Middleware plugin - intercepts agent execution
 */
export interface MiddlewarePlugin extends Plugin {
  type: 'middleware';
  
  /** Priority (lower = earlier) */
  priority?: number;
  
  /** Called before task execution */
  beforeTask?(task: string, context: MiddlewareContext): Promise<string | void> | string | void;
  
  /** Called after task execution */
  afterTask?(result: any, context: MiddlewareContext): Promise<any> | any;
  
  /** Called before each step */
  beforeStep?(step: any, context: MiddlewareContext): Promise<any | void> | any | void;
  
  /** Called after each step */
  afterStep?(step: any, result: any, context: MiddlewareContext): Promise<any> | any;
  
  /** Called on error */
  onError?(error: Error, context: MiddlewareContext): Promise<void> | void;
}

/**
 * Extension plugin - general purpose extensions
 */
export interface ExtensionPlugin extends Plugin {
  type: 'extension';
  
  /** Extension methods to add to agent */
  extend?(agent: any): void;
}

// -------------------- Plugin Context --------------------

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
  /** Plugin manager reference */
  manager: PluginManagerInterface;
  
  /** Plugin configuration */
  config: Record<string, any>;
  
  /** Logger */
  logger: PluginLogger;
  
  /** Event emitter */
  events: PluginEvents;
  
  /** Get another plugin */
  getPlugin<T extends Plugin>(id: string): T | undefined;
  
  /** Register a tool */
  registerTool(tool: ToolDefinition): void;
  
  /** Unregister a tool */
  unregisterTool(name: string): void;
}

/**
 * Context for middleware execution
 */
export interface MiddlewareContext {
  /** Task ID */
  taskId: string;
  
  /** Current step ID */
  stepId?: string;
  
  /** Shared data store */
  data: Map<string, any>;
  
  /** Plugin configuration */
  config: Record<string, any>;
  
  /** Logger */
  logger: PluginLogger;
}

// -------------------- Plugin Manager Interface --------------------

export interface PluginManagerInterface {
  /** Load a plugin */
  load(plugin: Plugin | string, config?: Record<string, any>): Promise<void>;
  
  /** Unload a plugin */
  unload(pluginId: string): Promise<void>;
  
  /** Get a plugin */
  get<T extends Plugin>(id: string): T | undefined;
  
  /** Get all plugins */
  getAll(): Plugin[];
  
  /** Get plugins by type */
  getByType<T extends Plugin>(type: PluginType): T[];
  
  /** Check if plugin is loaded */
  has(id: string): boolean;
  
  /** Enable a plugin */
  enable(id: string): Promise<void>;
  
  /** Disable a plugin */
  disable(id: string): Promise<void>;
  
  /** Get plugin status */
  getStatus(id: string): PluginStatus;
}

// -------------------- Plugin Logger --------------------

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// -------------------- Plugin Events --------------------

export interface PluginEvents {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

// -------------------- Plugin Configuration --------------------

export interface PluginConfigSchema {
  [key: string]: PluginConfigField;
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: any;
  description?: string;
  validate?: (value: any) => boolean | string;
}

// -------------------- Plugin Loader Options --------------------

export interface PluginLoaderOptions {
  /** Directories to search for plugins */
  pluginDirs?: string[];
  
  /** Auto-load plugins on start */
  autoLoad?: boolean;
  
  /** Plugin configurations */
  configs?: Record<string, Record<string, any>>;
  
  /** Plugins to disable */
  disabled?: string[];
}

// -------------------- Plugin Manifest --------------------

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  main: string;
  description?: string;
  author?: string;
  homepage?: string;
  dependencies?: string[];
  agentCoreVersion?: string;
  configSchema?: PluginConfigSchema;
}

// -------------------- Type Guards --------------------

export function isToolPlugin(plugin: Plugin): plugin is ToolPlugin {
  return plugin.type === 'tool';
}

export function isLLMPlugin(plugin: Plugin): plugin is LLMPlugin {
  return plugin.type === 'llm';
}

export function isStoragePlugin(plugin: Plugin): plugin is StoragePlugin {
  return plugin.type === 'storage';
}

export function isMiddlewarePlugin(plugin: Plugin): plugin is MiddlewarePlugin {
  return plugin.type === 'middleware';
}

export function isExtensionPlugin(plugin: Plugin): plugin is ExtensionPlugin {
  return plugin.type === 'extension';
}
