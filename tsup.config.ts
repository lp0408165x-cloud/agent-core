import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library build
  {
    entry: {
      // Main entry
      index: 'src/index.ts',
      
      // Core module
      'core/index': 'src/core/index.ts',
      
      // LLM module
      'llm/index': 'src/llm/index.ts',
      
      // Persistence module (with Node/Browser split)
      'persistence/index': 'src/persistence/index.ts',
      'persistence/node': 'src/persistence/node.ts',
      'persistence/browser': 'src/persistence/browser.ts',
      
      // Realtime module (with Server/Client split)
      'realtime/index': 'src/realtime/index.ts',
      'realtime/server': 'src/realtime/server.ts',
      'realtime/client': 'src/realtime/client.ts',
      
      // Plugins module
      'plugins/index': 'src/plugins/index.ts',
      
      // CLI (included in main build)
      'cli/index': 'src/cli/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    target: 'node18',
    outDir: 'dist',
    external: ['ws', 'fs', 'path', 'crypto', 'readline'],
    esbuildOptions(options) {
      options.banner = {
        js: '/* Agent Core - LLM Task Automation */',
      };
    },
  },
]);
