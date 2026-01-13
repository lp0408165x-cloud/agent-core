// ============================================
// Agent Core - Persistence (Browser Only)
// ============================================
// This module contains browser-specific storage adapters
// Safe to import in browser environments

export {
  LocalStorageAdapter,
  IndexedDBAdapter,
  MemoryStorageAdapter
} from './adapters';

export type {
  IndexedDBConfig
} from './adapters';
