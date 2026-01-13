// ============================================
// Agent Core - Plugin Manager
// ============================================

import type {
  Plugin,
  PluginType,
  PluginStatus,
  PluginContext,
  PluginLogger,
  PluginEvents,
  PluginManagerInterface,
  ToolPlugin,
  LLMPlugin,
  StoragePlugin,
  MiddlewarePlugin,
  MiddlewareContext
} from './types';
import { isToolPlugin, isMiddlewarePlugin } from './types';
import { PluginRegistry } from './PluginRegistry';
import { PluginLoader, createPluginLoader } from './PluginLoader';
import { EventEmitter } from '../utils';
import type { ToolDefinition } from '../types';

// -------------------- Plugin Manager Options --------------------

export interface PluginManagerOptions {
  /** Plugin loader */
  loader?: PluginLoader;
  
  /** Plugin configurations */
  configs?: Record<string, Record<string, any>>;
  
  /** Plugins to disable */
  disabled?: string[];
  
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// -------------------- Plugin Manager --------------------

export class PluginManager extends EventEmitter implements PluginManagerInterface {
  private registry: PluginRegistry;
  private loader: PluginLoader;
  private configs: Record<string, Record<string, any>>;
  private disabled: Set<string>;
  private logLevel: string;
  private dynamicTools: Map<string, ToolDefinition[]> = new Map();
  
  constructor(options: PluginManagerOptions = {}) {
    super();
    
    this.registry = new PluginRegistry();
    this.loader = options.loader || createPluginLoader();
    this.configs = options.configs || {};
    this.disabled = new Set(options.disabled || []);
    this.logLevel = options.logLevel || 'info';
    
    // Forward registry events
    this.registry.on('plugin:registered', (plugin: Plugin) => {
      this.emit('plugin:registered', plugin);
    });
    
    this.registry.on('plugin:status', (data: { id: string; status: PluginStatus }) => {
      this.emit('plugin:status', data);
    });
  }
  
  // -------------------- Load/Unload --------------------
  
  /**
   * Load a plugin
   */
  async load(
    pluginOrPath: Plugin | string,
    config?: Record<string, any>
  ): Promise<void> {
    let plugin: Plugin;
    
    // Load plugin
    if (typeof pluginOrPath === 'string') {
      plugin = await this.loader.loadFromModule(pluginOrPath);
    } else {
      plugin = this.loader.loadFromObject(pluginOrPath);
    }
    
    // Check if disabled
    if (this.disabled.has(plugin.id)) {
      this.log('info', `Plugin "${plugin.id}" is disabled, skipping`);
      return;
    }
    
    // Merge config
    const pluginConfig = {
      ...this.configs[plugin.id],
      ...config
    };
    
    // Register
    this.registry.register(plugin, pluginConfig);
    this.registry.setStatus(plugin.id, 'loading');
    
    try {
      // Create context
      const context = this.createContext(plugin.id);
      
      // Initialize
      if (plugin.init) {
        await plugin.init(context);
      }
      
      // Type-specific setup
      await this.setupPlugin(plugin);
      
      // Mark as active
      this.registry.setStatus(plugin.id, 'active');
      this.log('info', `Plugin "${plugin.id}" loaded successfully`);
      this.emit('plugin:loaded', plugin);
      
    } catch (error) {
      this.registry.setStatus(plugin.id, 'error', error as Error);
      this.log('error', `Failed to initialize plugin "${plugin.id}":`, error);
      throw error;
    }
  }
  
  /**
   * Load multiple plugins
   */
  async loadAll(plugins: (Plugin | string)[]): Promise<void> {
    for (const plugin of plugins) {
      await this.load(plugin);
    }
  }
  
  /**
   * Unload a plugin
   */
  async unload(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }
    
    // Check dependents
    const dependents = this.registry.getDependents(pluginId);
    const activeDependents = dependents.filter(
      id => this.registry.getStatus(id) === 'active'
    );
    
    if (activeDependents.length > 0) {
      throw new Error(
        `Cannot unload "${pluginId}", required by active plugins: ${activeDependents.join(', ')}`
      );
    }
    
    try {
      // Cleanup
      if (plugin.destroy) {
        await plugin.destroy();
      }
      
      // Type-specific cleanup
      await this.cleanupPlugin(plugin);
      
      // Unregister
      this.registry.setStatus(pluginId, 'unloaded');
      this.registry.unregister(pluginId);
      
      this.log('info', `Plugin "${pluginId}" unloaded`);
      this.emit('plugin:unloaded', plugin);
      
    } catch (error) {
      this.log('error', `Error unloading plugin "${pluginId}":`, error);
      throw error;
    }
  }
  
  /**
   * Reload a plugin
   */
  async reload(pluginId: string): Promise<void> {
    const entry = this.registry.getEntry(pluginId);
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }
    
    const { plugin, config } = entry;
    
    await this.unload(pluginId);
    await this.load(plugin, config);
  }
  
  // -------------------- Enable/Disable --------------------
  
  /**
   * Enable a disabled plugin
   */
  async enable(pluginId: string): Promise<void> {
    this.disabled.delete(pluginId);
    
    const plugin = this.registry.get(pluginId);
    if (plugin && this.registry.getStatus(pluginId) === 'disabled') {
      await this.load(plugin, this.registry.getConfig(pluginId));
    }
  }
  
  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    this.disabled.add(pluginId);
    
    if (this.registry.getStatus(pluginId) === 'active') {
      await this.unload(pluginId);
    }
    
    this.registry.setStatus(pluginId, 'disabled');
  }
  
  // -------------------- Query --------------------
  
  /**
   * Get a plugin
   */
  get<T extends Plugin>(id: string): T | undefined {
    return this.registry.get<T>(id);
  }
  
  /**
   * Get all plugins
   */
  getAll(): Plugin[] {
    return this.registry.getAll();
  }
  
  /**
   * Get plugins by type
   */
  getByType<T extends Plugin>(type: PluginType): T[] {
    return this.registry.getByType<T>(type);
  }
  
  /**
   * Check if plugin exists
   */
  has(id: string): boolean {
    return this.registry.has(id);
  }
  
  /**
   * Get plugin status
   */
  getStatus(id: string): PluginStatus {
    return this.registry.getStatus(id);
  }
  
  /**
   * Get all tools (built-in + plugins)
   */
  getAllTools(): ToolDefinition[] {
    return this.registry.getAllTools();
  }
  
  /**
   * Get registry stats
   */
  getStats() {
    return this.registry.getStats();
  }
  
  // -------------------- Middleware Execution --------------------
  
  /**
   * Execute middleware before task
   */
  async executeBeforeTask(
    task: string,
    context: Omit<MiddlewareContext, 'logger'>
  ): Promise<string> {
    const middlewares = this.registry.getMiddlewarePlugins();
    let currentTask = task;
    
    for (const middleware of middlewares) {
      if (this.registry.getStatus(middleware.id) !== 'active') continue;
      if (!middleware.beforeTask) continue;
      
      const ctx = this.createMiddlewareContext(middleware.id, context);
      const result = await middleware.beforeTask(currentTask, ctx);
      if (typeof result === 'string') {
        currentTask = result;
      }
    }
    
    return currentTask;
  }
  
  /**
   * Execute middleware after task
   */
  async executeAfterTask(
    result: any,
    context: Omit<MiddlewareContext, 'logger'>
  ): Promise<any> {
    const middlewares = this.registry.getMiddlewarePlugins().reverse();
    let currentResult = result;
    
    for (const middleware of middlewares) {
      if (this.registry.getStatus(middleware.id) !== 'active') continue;
      if (!middleware.afterTask) continue;
      
      const ctx = this.createMiddlewareContext(middleware.id, context);
      currentResult = await middleware.afterTask(currentResult, ctx);
    }
    
    return currentResult;
  }
  
  /**
   * Execute middleware before step
   */
  async executeBeforeStep(
    step: any,
    context: Omit<MiddlewareContext, 'logger'>
  ): Promise<any> {
    const middlewares = this.registry.getMiddlewarePlugins();
    let currentStep = step;
    
    for (const middleware of middlewares) {
      if (this.registry.getStatus(middleware.id) !== 'active') continue;
      if (!middleware.beforeStep) continue;
      
      const ctx = this.createMiddlewareContext(middleware.id, context);
      const result = await middleware.beforeStep(currentStep, ctx);
      if (result !== undefined) {
        currentStep = result;
      }
    }
    
    return currentStep;
  }
  
  /**
   * Execute middleware after step
   */
  async executeAfterStep(
    step: any,
    result: any,
    context: Omit<MiddlewareContext, 'logger'>
  ): Promise<any> {
    const middlewares = this.registry.getMiddlewarePlugins().reverse();
    let currentResult = result;
    
    for (const middleware of middlewares) {
      if (this.registry.getStatus(middleware.id) !== 'active') continue;
      if (!middleware.afterStep) continue;
      
      const ctx = this.createMiddlewareContext(middleware.id, context);
      currentResult = await middleware.afterStep(step, currentResult, ctx);
    }
    
    return currentResult;
  }
  
  /**
   * Execute middleware on error
   */
  async executeOnError(
    error: Error,
    context: Omit<MiddlewareContext, 'logger'>
  ): Promise<void> {
    const middlewares = this.registry.getMiddlewarePlugins();
    
    for (const middleware of middlewares) {
      if (this.registry.getStatus(middleware.id) !== 'active') continue;
      if (!middleware.onError) continue;
      
      try {
        const ctx = this.createMiddlewareContext(middleware.id, context);
        await middleware.onError(error, ctx);
      } catch (err) {
        this.log('error', `Middleware "${middleware.id}" error handler failed:`, err);
      }
    }
  }
  
  // -------------------- Private Methods --------------------
  
  private createContext(pluginId: string): PluginContext {
    const config = this.registry.getConfig(pluginId);
    
    return {
      manager: this,
      config,
      logger: this.createLogger(pluginId),
      events: this.createEventProxy(pluginId),
      getPlugin: <T extends Plugin>(id: string) => this.registry.get<T>(id),
      registerTool: (tool: ToolDefinition) => this.registerDynamicTool(pluginId, tool),
      unregisterTool: (name: string) => this.unregisterDynamicTool(pluginId, name)
    };
  }
  
  private createMiddlewareContext(
    pluginId: string,
    baseContext: Omit<MiddlewareContext, 'logger'>
  ): MiddlewareContext {
    return {
      ...baseContext,
      config: this.registry.getConfig(pluginId),
      logger: this.createLogger(pluginId)
    };
  }
  
  private createLogger(pluginId: string): PluginLogger {
    const prefix = `[${pluginId}]`;
    
    return {
      debug: (msg, ...args) => this.log('debug', prefix, msg, ...args),
      info: (msg, ...args) => this.log('info', prefix, msg, ...args),
      warn: (msg, ...args) => this.log('warn', prefix, msg, ...args),
      error: (msg, ...args) => this.log('error', prefix, msg, ...args)
    };
  }
  
  private createEventProxy(pluginId: string): PluginEvents {
    return {
      on: (event, handler) => this.on(`${pluginId}:${event}`, handler),
      off: (event, handler) => this.off(`${pluginId}:${event}`, handler),
      emit: (event, ...args) => this.emit(`${pluginId}:${event}`, args.length === 1 ? args[0] : args)
    };
  }
  
  private async setupPlugin(plugin: Plugin): Promise<void> {
    // Tool plugin: register tools
    if (isToolPlugin(plugin)) {
      for (const tool of plugin.tools) {
        this.registerDynamicTool(plugin.id, tool);
      }
    }
  }
  
  private async cleanupPlugin(plugin: Plugin): Promise<void> {
    // Remove dynamic tools
    this.dynamicTools.delete(plugin.id);
  }
  
  private registerDynamicTool(pluginId: string, tool: ToolDefinition): void {
    if (!this.dynamicTools.has(pluginId)) {
      this.dynamicTools.set(pluginId, []);
    }
    this.dynamicTools.get(pluginId)!.push(tool);
    this.emit('tool:registered', { tool, pluginId });
  }
  
  private unregisterDynamicTool(pluginId: string, toolName: string): void {
    const tools = this.dynamicTools.get(pluginId);
    if (tools) {
      const index = tools.findIndex(t => t.name === toolName);
      if (index !== -1) {
        const tool = tools.splice(index, 1)[0];
        this.emit('tool:unregistered', { tool, pluginId });
      }
    }
  }
  
  private log(level: string, ...args: any[]): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) >= levels.indexOf(this.logLevel)) {
      const method = level as keyof Console;
      (console[method] as Function)('[PluginManager]', ...args);
    }
  }
}

// -------------------- Factory --------------------

export function createPluginManager(options?: PluginManagerOptions): PluginManager {
  return new PluginManager(options);
}
