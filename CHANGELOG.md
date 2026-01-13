# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-12

### Added

#### Core Module
- `Agent` - Main controller with event-driven architecture
- `CorePlanner` - LLM-powered task planning with dependency resolution
- `Executor` - Concurrent step execution with retry and timeout
- `StateMachine` - XState-compatible state management
- `ToolRegistry` - Tool registration and validation
- 13 built-in tools (file, http, data processing, etc.)

#### Persistence Module
- `PersistenceManager` - Task storage, checkpoints, history
- `MemoryStorageAdapter` - In-memory storage with TTL
- `FileStorageAdapter` - Node.js file-based persistence
- `LocalStorageAdapter` - Browser localStorage support
- `IndexedDBAdapter` - Browser IndexedDB for large data
- Automatic task saving and recovery
- Plan versioning support

#### Realtime Module
- `RealtimeServer` - WebSocket server implementation
- `WebSocketClient` - Browser/Node WebSocket client
- `SSEServer` - Server-Sent Events server
- `SSEClient` - SSE client implementation
- `RealtimeAgent` - Agent with real-time event broadcasting
- Task subscription and filtering
- Client command handling (confirm, cancel, pause, resume)

#### LLM Module
- `OpenAIClient` - OpenAI API integration
  - GPT-4o, GPT-4o-mini, GPT-4, GPT-3.5 support
  - JSON mode, streaming, usage tracking
- `AnthropicClient` - Anthropic API integration
  - Claude 3.5 Sonnet/Haiku, Claude 3 support
  - Vision, streaming, usage tracking
- `createLLMClient` - Factory function with provider abstraction
- `RateLimitedClient` - Automatic rate limiting wrapper
- `CachedClient` - Response caching wrapper
- `MultiProviderClient` - Fallback and load balancing
- Token estimation utilities

#### Testing
- Vitest configuration
- Mock LLM implementation
- Agent basic operations tests
- Persistence tests
- Custom tools tests
- CBP document processing tests
- Demo script

### Technical Details
- TypeScript 5.3+ with strict mode
- Dual CJS/ESM builds
- Tree-shakeable exports
- Node.js 18+ required
- Optional WebSocket (`ws`) dependency

---

## [Unreleased]

### Planned
- Google Gemini integration
- Mistral AI integration
- Azure OpenAI improvements
- Plugin system
- CLI tool
- Visual workflow editor
