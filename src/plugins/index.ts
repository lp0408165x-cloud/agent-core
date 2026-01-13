// ============================================
// Agent Core - Plugin System
// ============================================

// Types
export type {
  Plugin,
  PluginType,
  PluginStatus,
  ToolPlugin,
  LLMPlugin,
  StoragePlugin,
  MiddlewarePlugin,
  ExtensionPlugin,
  PluginContext,
  MiddlewareContext,
  PluginManagerInterface,
  PluginLogger,
  PluginEvents,
  PluginConfigSchema,
  PluginConfigField,
  PluginLoaderOptions,
  PluginManifest
} from './types';

// Type Guards
export {
  isToolPlugin,
  isLLMPlugin,
  isStoragePlugin,
  isMiddlewarePlugin,
  isExtensionPlugin
} from './types';

// Plugin Registry
export { PluginRegistry } from './PluginRegistry';

// Plugin Loader
export {
  PluginLoader,
  PluginLoadError,
  createPluginLoader
} from './PluginLoader';

// Plugin Manager
export {
  PluginManager,
  createPluginManager
} from './PluginManager';
export type { PluginManagerOptions } from './PluginManager';

// Example Plugins
export {
  weatherToolPlugin,
  customLLMPlugin,
  redisStoragePlugin,
  loggingMiddlewarePlugin,
  rateLimitMiddlewarePlugin,
  metricsExtensionPlugin,
  createToolPlugin,
  createMiddlewarePlugin
} from './examples';
