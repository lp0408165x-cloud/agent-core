// ============================================
// Agent Core - Storage Adapters
// ============================================

import { StorageAdapter } from './types';

// -------------------- Config Types --------------------

export interface IndexedDBConfig {
  dbName?: string;
  storeName?: string;
}

export interface FileStorageConfig {
  directory: string;
  encoding?: BufferEncoding;
}

// -------------------- Memory Storage --------------------

export class MemoryStorageAdapter implements StorageAdapter {
  private store: Map<string, { value: any; expiresAt: number | null }> = new Map();
  private connected: boolean = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async get<T>(key: string): Promise<T | null> {
    this.checkConnection();
    const entry = this.store.get(key);
    
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.checkConnection();
    const expiresAt = ttl ? Date.now() + ttl : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    this.checkConnection();
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    this.checkConnection();
    const entry = this.store.get(key);
    
    if (!entry) return false;
    
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }
    
    return result;
  }

  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, ttl);
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern?: string): Promise<string[]> {
    this.checkConnection();
    const allKeys = Array.from(this.store.keys());
    
    if (!pattern) return allKeys;
    
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async clear(pattern?: string): Promise<void> {
    this.checkConnection();
    
    if (!pattern) {
      this.store.clear();
      return;
    }
    
    const keysToDelete = await this.keys(pattern);
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }

  private checkConnection(): void {
    if (!this.connected) {
      throw new Error('Storage not connected');
    }
  }

  // Utility methods
  getSize(): number {
    return this.store.size;
  }

  getStats(): { size: number; keys: number } {
    return {
      size: JSON.stringify([...this.store.entries()]).length,
      keys: this.store.size
    };
  }
}

// -------------------- File Storage --------------------

export class FileStorageAdapter implements StorageAdapter {
  private basePath: string;
  private connected: boolean = false;
  private cache: Map<string, any> = new Map();
  private dirty: Set<string> = new Set();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async connect(): Promise<void> {
    if (typeof window !== 'undefined') {
      throw new Error('FileStorageAdapter is not supported in browser');
    }

    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    // Ensure directory exists
    await fs.mkdir(this.basePath, { recursive: true });
    
    // Load index
    await this.loadIndex();
    
    // Start periodic flush
    this.flushInterval = setInterval(() => this.flush(), 5000);
    
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
    this.cache.clear();
    this.dirty.clear();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async get<T>(key: string): Promise<T | null> {
    this.checkConnection();

    // Check cache first
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }
      return entry.value as T;
    }

    // Load from file
    try {
      const filePath = this.getFilePath(key);
      const fs = await import('fs').then(m => m.promises);
      const data = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(data);

      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      this.cache.set(key, entry);
      return entry.value as T;
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.checkConnection();

    const entry = {
      value,
      expiresAt: ttl ? Date.now() + ttl : null,
      updatedAt: Date.now()
    };

    this.cache.set(key, entry);
    this.dirty.add(key);
  }

  async delete(key: string): Promise<boolean> {
    this.checkConnection();

    this.cache.delete(key);
    this.dirty.delete(key);

    try {
      const filePath = this.getFilePath(key);
      const fs = await import('fs').then(m => m.promises);
      await fs.unlink(filePath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    this.checkConnection();

    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return false;
      }
      return true;
    }

    try {
      const filePath = this.getFilePath(key);
      const fs = await import('fs').then(m => m.promises);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    await Promise.all(
      keys.map(async key => {
        const value = await this.get<T>(key);
        if (value !== null) {
          result.set(key, value);
        }
      })
    );
    return result;
  }

  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    await Promise.all(
      Array.from(entries).map(([key, value]) => this.set(key, value, ttl))
    );
  }

  async deleteMany(keys: string[]): Promise<number> {
    const results = await Promise.all(keys.map(key => this.delete(key)));
    return results.filter(Boolean).length;
  }

  async keys(pattern?: string): Promise<string[]> {
    this.checkConnection();

    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    try {
      const files = await fs.readdir(this.basePath);
      let keys = files
        .filter(f => f.endsWith('.json'))
        .map(f => this.fileNameToKey(f));

      if (pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        keys = keys.filter(key => regex.test(key));
      }

      return keys;
    } catch {
      return [];
    }
  }

  async clear(pattern?: string): Promise<void> {
    const keysToDelete = await this.keys(pattern);
    await this.deleteMany(keysToDelete);
  }

  // Internal methods
  private getFilePath(key: string): string {
    const safeKey = this.keyToFileName(key);
    return `${this.basePath}/${safeKey}.json`;
  }

  private keyToFileName(key: string): string {
    return Buffer.from(key).toString('base64url');
  }

  private fileNameToKey(fileName: string): string {
    const base64 = fileName.replace('.json', '');
    return Buffer.from(base64, 'base64url').toString();
  }

  private async loadIndex(): Promise<void> {
    // Load all keys into cache for fast access
    const keys = await this.keys();
    // Only load metadata, not full values
  }

  private async flush(): Promise<void> {
    if (this.dirty.size === 0) return;

    const fs = await import('fs').then(m => m.promises);
    const keysToFlush = [...this.dirty];
    this.dirty.clear();

    await Promise.all(
      keysToFlush.map(async key => {
        const entry = this.cache.get(key);
        if (entry) {
          const filePath = this.getFilePath(key);
          await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
        }
      })
    );
  }

  private checkConnection(): void {
    if (!this.connected) {
      throw new Error('Storage not connected');
    }
  }
}

// -------------------- LocalStorage Adapter (Browser) --------------------

export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;
  private connected: boolean = false;

  constructor(prefix: string = 'agent_') {
    this.prefix = prefix;
  }

  async connect(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('LocalStorage is not available');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private unprefixKey(key: string): string {
    return key.startsWith(this.prefix) ? key.slice(this.prefix.length) : key;
  }

  async get<T>(key: string): Promise<T | null> {
    this.checkConnection();

    try {
      const data = localStorage.getItem(this.prefixKey(key));
      if (!data) return null;

      const entry = JSON.parse(data);
      
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry.value as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.checkConnection();

    const entry = {
      value,
      expiresAt: ttl ? Date.now() + ttl : null
    };

    localStorage.setItem(this.prefixKey(key), JSON.stringify(entry));
  }

  async delete(key: string): Promise<boolean> {
    this.checkConnection();

    const prefixedKey = this.prefixKey(key);
    const exists = localStorage.getItem(prefixedKey) !== null;
    localStorage.removeItem(prefixedKey);
    return exists;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }
    return result;
  }

  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, ttl);
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern?: string): Promise<string[]> {
    this.checkConnection();

    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        allKeys.push(this.unprefixKey(key));
      }
    }

    if (!pattern) return allKeys;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async clear(pattern?: string): Promise<void> {
    const keysToDelete = await this.keys(pattern);
    await this.deleteMany(keysToDelete);
  }

  private checkConnection(): void {
    if (!this.connected) {
      throw new Error('Storage not connected');
    }
  }
}

// -------------------- IndexedDB Adapter (Browser) --------------------

export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'AgentCore', storeName: string = 'storage') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async connect(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  private getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Database not connected');
    const tx = this.db.transaction(this.storeName, mode);
    return tx.objectStore(this.storeName);
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) {
          resolve(null);
          return;
        }

        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          this.delete(key).then(() => resolve(null));
          return;
        }

        resolve(entry.value as T);
      };
    });
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const entry = {
        key,
        value,
        expiresAt: ttl ? Date.now() + ttl : null,
        updatedAt: Date.now()
      };

      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    await Promise.all(
      keys.map(async key => {
        const value = await this.get<T>(key);
        if (value !== null) result.set(key, value);
      })
    );
    return result;
  }

  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    await Promise.all(
      Array.from(entries).map(([key, value]) => this.set(key, value, ttl))
    );
  }

  async deleteMany(keys: string[]): Promise<number> {
    const results = await Promise.all(keys.map(key => this.delete(key)));
    return results.filter(Boolean).length;
  }

  async keys(pattern?: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let keys = request.result as string[];
        
        if (pattern) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          keys = keys.filter(key => regex.test(key));
        }

        resolve(keys);
      };
    });
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      return new Promise((resolve, reject) => {
        const store = this.getStore('readwrite');
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }

    const keysToDelete = await this.keys(pattern);
    await this.deleteMany(keysToDelete);
  }
}

// -------------------- Factory --------------------

export type StorageType = 'memory' | 'file' | 'localStorage' | 'indexedDB';

export interface StorageOptions {
  type: StorageType;
  path?: string;        // For file storage
  prefix?: string;      // For localStorage
  dbName?: string;      // For IndexedDB
  storeName?: string;   // For IndexedDB
}

export function createStorageAdapter(options: StorageOptions): StorageAdapter {
  switch (options.type) {
    case 'memory':
      return new MemoryStorageAdapter();
    
    case 'file':
      if (!options.path) {
        throw new Error('File storage requires path option');
      }
      return new FileStorageAdapter(options.path);
    
    case 'localStorage':
      return new LocalStorageAdapter(options.prefix);
    
    case 'indexedDB':
      return new IndexedDBAdapter(options.dbName, options.storeName);
    
    default:
      throw new Error(`Unknown storage type: ${options.type}`);
  }
}
