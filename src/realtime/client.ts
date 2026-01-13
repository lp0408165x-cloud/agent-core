// ============================================
// Agent Core - Realtime Client
// ============================================
// This module contains client-side realtime components
// Safe to import in both browser and Node.js

export {
  WebSocketClient,
  createWebSocketClient
} from './WebSocketClient';

export {
  SSEClient,
  createSSEClient
} from './SSEClient';

export type {
  SSEClientConfig
} from './SSEClient';

export type {
  // Types
  RealtimeMessage,
  MessageType,
  RealtimeTransport,
  ConnectionState,
  ConnectionInfo,
  CommandPayload,
  SubscribePayload
} from './types';
