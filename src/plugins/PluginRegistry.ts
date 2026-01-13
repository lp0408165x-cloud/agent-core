// ============================================
// Agent Core - Plugin Registry
// ============================================

import type {
  Plugin,
  PluginType,
  PluginStatus,
  ToolPlugin,
  LLMPlugin,
  StoragePlugin,
  MiddlewarePlugin,
  ExtensionPlugin,
  isToolPlugin,
  isLLMPlugin,
  isStoragePlugin,
  isMiddlewarePlugin
} from './types';
import { EventEmitter } from '../utils';

// -------------------- Plugin Entry --------------------

interface PluginEntry {
  plugin: Plugin;
  status: PluginStatus;
  config: Record<string, any>;
  loadedAt?: number;
  error?: Error;
}

// -------------------- Plugin Registry --------------------

export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginEntry> = new Map();
  
  /**
   * Register a plugin
   */
  register(plugin: Plugin, config: Record<string, any> = {}): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    
    // Validate plugin
    this.validatePlugin(plugin);
    
    // Check dependencies
    this.checkDependencies(plugin);
    
    // Register
    this.plugins.set(plugin.id, {
      plugin,
      status: 'unloaded',
      config
    });
    
    this.emit('plugin:registered', plugin);
  }
  
  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }
    
    if (entry.status === 'active') {
      throw new Error(`Plugin "${pluginId}" is active, unload it first`);
    }
    
    // Check if other plugins depend on this one
    const dependents = this.getDependents(pluginId);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister "${pluginId}", required by: ${dependents.join(', ')}`
      );
    }
    
    this.plugins.delete(pluginId);
    this.emit('plugin:unregistered', entry.plugin);
  }
  
  /**
   * Get a plugin by ID
   */
  get<T extends Plugin>(id: string): T | undefined {
    return this.plugins.get(id)?.plugin as T | undefined;
  }
  
  /**
   * Get all plugins
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values()).map(e => e.plugin);
  }
  
  /**
   * Get plugins by type
   */
  getByType<T extends Plugin>(type: PluginType): T[] {
    return Array.from(this.plugins.values())
      .filter(e => e.plugin.type === type)
      .map(e => e.plugin as T);
  }
  
  /**
   * Get all tool plugins
   */
  getToolPlugins(): ToolPlugin[] {
    return this.getByType<ToolPlugin>('tool');
  }
  
  /**
   * Get all LLM plugins
   */
  getLLMPlugins(): LLMPlugin[] {
    return this.getByType<LLMPlugin>('llm');
  }
  
  /**
   * Get all storage plugins
   */
  getStoragePlugins(): StoragePlugin[] {
    return this.getByType<StoragePlugin>('storage');
  }
  
  /**
   * Get all middleware plugins (sorted by priority)
   */
  getMiddlewarePlugins(): MiddlewarePlugin[] {
    return this.getByType<MiddlewarePlugin>('middleware')
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }
  
  /**
   * Get all extension plugins
   */
  getExtensionPlugins(): ExtensionPlugin[] {
    return this.getByType<ExtensionPlugin>('extension');
  }
  
  /**
   * Check if plugin exists
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }
  
  /**
   * Get plugin status
   */
  getStatus(id: string): PluginStatus {
    return this.plugins.get(id)?.status || 'unloaded';
  }
  
  /**
   * Set plugin status
   */
  setStatus(id: string, status: PluginStatus, error?: Error): void {
    const entry = this.plugins.get(id);
    if (entry) {
      entry.status = status;
      entry.error = error;
      if (status === 'active') {
        entry.loadedAt = Date.now();
      }
      this.emit('plugin:status', { id, status });
    }
  }
  
  /**
   * Get plugin configuration
   */
  getConfig(id: string): Record<string, any> {
    return this.plugins.get(id)?.config || {};
  }
  
  /**
   * Update plugin configuration
   */
  setConfig(id: string, config: Record<string, any>): void {
    const entry = this.plugins.get(id);
    if (entry) {
      entry.config = { ...entry.config, ...config };
      this.emit('plugin:config', { id, config: entry.config });
    }
  }
  
  /**
   * Get plugin entry (internal use)
   */
  getEntry(id: string): PluginEntry | undefined {
    return this.plugins.get(id);
  }
  
  /**
   * Get active plugins
   */
  getActive(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(e => e.status === 'active')
      .map(e => e.plugin);
  }
  
  /**
   * Get plugins that depend on given plugin
   */
  getDependents(pluginId: string): string[] {
    const dependents: string[] = [];
    for (const [id, entry] of this.plugins) {
      if (entry.plugin.dependencies?.includes(pluginId)) {
        dependents.push(id);
      }
    }
    return dependents;
  }
  
  /**
   * Get all tools from tool plugins
   */
  getAllTools(): import('../types').ToolDefinition[] {
    const tools: import('../types').ToolDefinition[] = [];
    for (const plugin of this.getToolPlugins()) {
      if (this.getStatus(plugin.id) === 'active') {
        tools.push(...plugin.tools);
      }
    }
    return tools;
  }
  
  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.emit('registry:cleared', {});
  }
  
  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    active: number;
    byType: Record<PluginType, number>;
  } {
    const byType: Record<PluginType, number> = {
      tool: 0,
      llm: 0,
      storage: 0,
      middleware: 0,
      extension: 0
    };
    
    let active = 0;
    
    for (const entry of this.plugins.values()) {
      byType[entry.plugin.type]++;
      if (entry.status === 'active') active++;
    }
    
    return {
      total: this.plugins.size,
      active,
      byType
    };
  }
  
  // -------------------- Private Methods --------------------
  
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.id || typeof plugin.id !== 'string') {
      throw new Error('Plugin must have a valid id');
    }
    
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a valid name');
    }
    
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('Plugin must have a valid version');
    }
    
    if (!plugin.type || !['tool', 'llm', 'storage', 'middleware', 'extension'].includes(plugin.type)) {
      throw new Error('Plugin must have a valid type');
    }
    
    // Type-specific validation
    if (plugin.type === 'tool') {
      const toolPlugin = plugin as ToolPlugin;
      if (!Array.isArray(toolPlugin.tools) || toolPlugin.tools.length === 0) {
        throw new Error('Tool plugin must have at least one tool');
      }
    }
    
    if (plugin.type === 'llm') {
      const llmPlugin = plugin as LLMPlugin;
      if (typeof llmPlugin.createClient !== 'function') {
        throw new Error('LLM plugin must have createClient function');
      }
    }
    
    if (plugin.type === 'storage') {
      const storagePlugin = plugin as StoragePlugin;
      if (typeof storagePlugin.createAdapter !== 'function') {
        throw new Error('Storage plugin must have createAdapter function');
      }
    }
  }
  
  private checkDependencies(plugin: Plugin): void {
    if (!plugin.dependencies) return;
    
    for (const depId of plugin.dependencies) {
      if (!this.plugins.has(depId)) {
        throw new Error(
          `Plugin "${plugin.id}" requires "${depId}" which is not registered`
        );
      }
      
      const depStatus = this.getStatus(depId);
      if (depStatus !== 'active') {
        throw new Error(
          `Plugin "${plugin.id}" requires "${depId}" which is not active (status: ${depStatus})`
        );
      }
    }
  }
}
