// ============================================
// Agent Core - Plugin Loader
// ============================================

import type { Plugin, PluginManifest, PluginLoaderOptions } from './types';

// -------------------- Plugin Loader --------------------

export class PluginLoader {
  private options: Required<PluginLoaderOptions>;
  
  constructor(options: PluginLoaderOptions = {}) {
    this.options = {
      pluginDirs: options.pluginDirs || ['./plugins'],
      autoLoad: options.autoLoad ?? false,
      configs: options.configs || {},
      disabled: options.disabled || []
    };
  }
  
  /**
   * Load plugin from a module/package
   */
  async loadFromModule(modulePath: string): Promise<Plugin> {
    try {
      // Dynamic import
      const module = await import(modulePath);
      
      // Get plugin export
      const plugin = module.default || module.plugin || module;
      
      if (!this.isValidPlugin(plugin)) {
        throw new Error(`Invalid plugin structure in ${modulePath}`);
      }
      
      return plugin as Plugin;
    } catch (error) {
      throw new PluginLoadError(
        `Failed to load plugin from ${modulePath}: ${(error as Error).message}`,
        modulePath
      );
    }
  }
  
  /**
   * Load plugin from manifest file
   */
  async loadFromManifest(manifestPath: string): Promise<Plugin> {
    try {
      // Read manifest
      const manifestModule = await import(manifestPath);
      const manifest: PluginManifest = manifestModule.default || manifestModule;
      
      // Validate manifest
      this.validateManifest(manifest);
      
      // Resolve main entry
      const basePath = manifestPath.replace(/[^/\\]+$/, '');
      const mainPath = basePath + manifest.main;
      
      // Load plugin
      const plugin = await this.loadFromModule(mainPath);
      
      // Merge manifest info
      return {
        ...plugin,
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || plugin.description,
        author: manifest.author || plugin.author,
        homepage: manifest.homepage || plugin.homepage,
        dependencies: manifest.dependencies || plugin.dependencies,
        agentCoreVersion: manifest.agentCoreVersion || plugin.agentCoreVersion,
        configSchema: manifest.configSchema || plugin.configSchema
      };
    } catch (error) {
      throw new PluginLoadError(
        `Failed to load plugin from manifest ${manifestPath}: ${(error as Error).message}`,
        manifestPath
      );
    }
  }
  
  /**
   * Load plugin from object (already instantiated)
   */
  loadFromObject(pluginObject: Plugin): Plugin {
    if (!this.isValidPlugin(pluginObject)) {
      throw new PluginLoadError(
        'Invalid plugin object structure',
        'object'
      );
    }
    return pluginObject;
  }
  
  /**
   * Create plugin from factory function
   */
  async loadFromFactory(
    factory: (config: Record<string, any>) => Plugin | Promise<Plugin>,
    config: Record<string, any> = {}
  ): Promise<Plugin> {
    try {
      const plugin = await factory(config);
      
      if (!this.isValidPlugin(plugin)) {
        throw new Error('Factory returned invalid plugin structure');
      }
      
      return plugin;
    } catch (error) {
      throw new PluginLoadError(
        `Failed to create plugin from factory: ${(error as Error).message}`,
        'factory'
      );
    }
  }
  
  /**
   * Discover plugins in configured directories
   * Note: Requires Node.js fs module, will be no-op in browser
   */
  async discoverPlugins(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];
    
    // This would need fs access - provide stub for now
    // In real implementation, scan pluginDirs for plugin.json files
    
    return manifests;
  }
  
  /**
   * Check if disabled
   */
  isDisabled(pluginId: string): boolean {
    return this.options.disabled.includes(pluginId);
  }
  
  /**
   * Get configuration for plugin
   */
  getConfig(pluginId: string): Record<string, any> {
    return this.options.configs[pluginId] || {};
  }
  
  /**
   * Validate a plugin object
   */
  isValidPlugin(obj: any): obj is Plugin {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.version === 'string' &&
      typeof obj.type === 'string' &&
      ['tool', 'llm', 'storage', 'middleware', 'extension'].includes(obj.type)
    );
  }
  
  /**
   * Validate manifest
   */
  private validateManifest(manifest: any): asserts manifest is PluginManifest {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('Manifest must be an object');
    }
    
    const required = ['id', 'name', 'version', 'type', 'main'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }
    
    if (!['tool', 'llm', 'storage', 'middleware', 'extension'].includes(manifest.type)) {
      throw new Error(`Invalid plugin type: ${manifest.type}`);
    }
  }
}

// -------------------- Plugin Load Error --------------------

export class PluginLoadError extends Error {
  constructor(
    message: string,
    public source: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PluginLoadError';
  }
}

// -------------------- Factory --------------------

export function createPluginLoader(options?: PluginLoaderOptions): PluginLoader {
  return new PluginLoader(options);
}
