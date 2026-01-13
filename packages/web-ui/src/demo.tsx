// ============================================
// Agent Core UI - Demo Application
// ============================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { AgentPanel } from './components/AgentPanel';

const App: React.FC = () => {
  return (
    <div className="demo-panel">
      <AgentPanel
        wsUrl="ws://localhost:8080/ws"
        theme="light"
        onTaskComplete={(result) => {
          console.log('Task completed:', result);
        }}
        onError={(error) => {
          console.error('Agent error:', error);
        }}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
