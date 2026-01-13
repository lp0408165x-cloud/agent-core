// ============================================
// Agent Core - Persistence (Node.js Only)
// ============================================
// This module contains Node.js-specific storage adapters
// Do NOT import in browser environments

export {
  FileStorageAdapter,
  MemoryStorageAdapter
} from './adapters';

export type {
  FileStorageConfig
} from './adapters';
