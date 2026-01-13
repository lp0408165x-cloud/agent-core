// ============================================
// Agent Core - CLI Tool
// ============================================
// Usage:
//   npx agent-core run "task description"
//   npx agent-core interactive
//   npx agent-core --help

import { createAgent } from '../core';
import { defaultTools } from '../tools';
import { createOpenAIClient } from '../llm/OpenAIClient';
import { createAnthropicClient } from '../llm/AnthropicClient';
import { createGeminiClient } from '../llm/GeminiClient';
import { createMistralClient } from '../llm/MistralClient';
import { createOllamaClient } from '../llm/OllamaClient';
import type { LLMClient, AgentResponse, ExecutionPlan } from '../types';

// -------------------- Types --------------------

interface CLIOptions {
  llm: 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'ollama' | 'mock';
  model?: string;
  verbose: boolean;
  maxSteps: number;
  timeout: number;
  tools: string[];
  ollamaUrl?: string;
}

// -------------------- Colors (no dependencies) --------------------

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// -------------------- Help --------------------

function printHelp(): void {
  console.log(`
${c('cyan', c('bold', 'Agent Core CLI'))} - LLM-powered task automation

${c('yellow', 'USAGE:')}
  agent-core <command> [options]

${c('yellow', 'COMMANDS:')}
  run <task>        Execute a task
  interactive       Start interactive mode
  list-tools        List available tools
  version           Show version
  help              Show this help

${c('yellow', 'OPTIONS:')}
  --llm <provider>  LLM provider: openai, anthropic, gemini, mistral, ollama, mock
  --model <name>    Model name (e.g., gpt-4o-mini, claude-3-haiku)
  --verbose, -v     Show detailed output
  --max-steps <n>   Maximum execution steps (default: 20)
  --timeout <ms>    Timeout in milliseconds (default: 60000)
  --tools <list>    Comma-separated tool names to enable

${c('yellow', 'EXAMPLES:')}
  ${c('dim', '# Run a simple task with mock LLM')}
  agent-core run "分析这个文件并生成报告"

  ${c('dim', '# Use OpenAI with verbose output')}
  agent-core run "Process data" --llm openai --verbose

  ${c('dim', '# Interactive mode')}
  agent-core interactive --llm anthropic

${c('yellow', 'ENVIRONMENT VARIABLES:')}
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key
  GOOGLE_API_KEY      Google Gemini API key
  MISTRAL_API_KEY     Mistral API key
`);
}

// -------------------- Version --------------------

function printVersion(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    console.log(`agent-core v${pkg.version}`);
  } catch {
    console.log('agent-core v1.0.0');
  }
}

// -------------------- List Tools --------------------

function listTools(): void {
  console.log(`\n${c('cyan', c('bold', 'Available Tools:'))}\n`);
  
  const categories = new Map<string, typeof defaultTools>();
  
  for (const tool of defaultTools) {
    const cat = tool.category || 'other';
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(tool);
  }
  
  for (const [category, tools] of categories) {
    console.log(c('yellow', `  ${category.toUpperCase()}`));
    for (const tool of tools) {
      console.log(`    ${c('green', tool.name)} - ${c('dim', tool.description)}`);
    }
    console.log('');
  }
}

// -------------------- Mock LLM --------------------

function createMockLLM(): LLMClient {
  return {
    async complete(prompt: string): Promise<string> {
      // Simple mock responses for demo
      if (prompt.includes('analyze') || prompt.includes('分析')) {
        return JSON.stringify({
          taskType: 'analysis',
          resources: ['file'],
          outputFormat: 'report',
          risks: [],
          confirmationPoints: [],
          complexity: 'low'
        });
      }
      
      // Default plan
      return JSON.stringify([
        {
          id: 'step_1',
          type: 'tool',
          name: 'Analyze Input',
          description: 'Analyze the input task',
          tool: 'echo',
          params: { message: 'Analyzing...' }
        },
        {
          id: 'step_2', 
          type: 'tool',
          name: 'Generate Output',
          description: 'Generate the output',
          tool: 'echo',
          params: { message: 'Task completed!' }
        }
      ]);
    },
    
    async chat(messages): Promise<string> {
      const lastMessage = messages[messages.length - 1];
      return this.complete(lastMessage?.content || '');
    }
  };
}

// -------------------- Create LLM Client --------------------

function createLLMClient(options: CLIOptions): LLMClient {
  switch (options.llm) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error(c('red', 'Error: OPENAI_API_KEY environment variable not set'));
        process.exit(1);
      }
      return createOpenAIClient({
        apiKey,
        model: options.model || 'gpt-4o-mini'
      });
    }
    
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(c('red', 'Error: ANTHROPIC_API_KEY environment variable not set'));
        process.exit(1);
      }
      return createAnthropicClient({
        apiKey,
        model: options.model || 'claude-3-haiku-20240307'
      });
    }

    case 'gemini': {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        console.error(c('red', 'Error: GOOGLE_API_KEY environment variable not set'));
        process.exit(1);
      }
      return createGeminiClient({
        apiKey,
        model: options.model || 'gemini-1.5-flash'
      });
    }

    case 'mistral': {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        console.error(c('red', 'Error: MISTRAL_API_KEY environment variable not set'));
        process.exit(1);
      }
      return createMistralClient({
        apiKey,
        model: options.model || 'mistral-small-latest'
      });
    }

    case 'ollama': {
      return createOllamaClient({
        baseURL: options.ollamaUrl || 'http://localhost:11434',
        model: options.model || 'llama3.2'
      });
    }
    
    case 'mock':
    default:
      return createMockLLM();
  }
}

// -------------------- Run Task --------------------

async function runTask(task: string, options: CLIOptions): Promise<void> {
  console.log(`\n${c('cyan', '▶')} ${c('bold', 'Starting task...')}`);
  console.log(`${c('dim', '  Task:')} ${task}`);
  console.log(`${c('dim', '  LLM:')} ${options.llm}${options.model ? ` (${options.model})` : ''}`);
  console.log('');

  const llm = createLLMClient(options);
  
  // Filter tools if specified
  let tools = defaultTools;
  if (options.tools.length > 0) {
    tools = defaultTools.filter(t => options.tools.includes(t.name));
    console.log(`${c('dim', '  Tools:')} ${tools.map(t => t.name).join(', ')}`);
  }

  const agent = createAgent({
    llm,
    plannerConfig: {
      model: options.model || 'default',
      maxSteps: options.maxSteps,
      enableParallel: true,
      confidenceThreshold: 0.8,
      planningTimeout: options.timeout
    },
    executorConfig: {
      maxConcurrency: 3,
      defaultTimeout: 30000,
      retryDelay: 1000,
      maxRetries: 3
    },
    tools
  });

  // Event listeners
  if (options.verbose) {
    agent.on('plan:created', (data: { plan: ExecutionPlan }) => {
      console.log(`\n${c('blue', '📋 Plan created:')} ${data.plan.steps.length} steps`);
      data.plan.steps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step.name} ${c('dim', `(${step.type})`)}`);
      });
      console.log('');
    });

    agent.on('step:start', (data: { stepId: string; stepName: string }) => {
      process.stdout.write(`${c('yellow', '⏳')} ${data.stepName}...`);
    });

    agent.on('step:complete', (data: { stepName: string; result: { status: string } }) => {
      const status = data.result.status === 'success' 
        ? c('green', '✓') 
        : c('red', '✗');
      console.log(` ${status}`);
    });
  }

  agent.on('status', (data: { state: string; message: string }) => {
    if (options.verbose) {
      console.log(`${c('dim', `[${data.state}]`)} ${data.message}`);
    }
  });

  // Execute
  const startTime = Date.now();
  
  try {
    const response: AgentResponse = await agent.process(task);
    const duration = Date.now() - startTime;

    console.log('');
    if (response.success) {
      console.log(`${c('green', '✅ Task completed successfully!')}`);
      
      if (response.output) {
        console.log(`\n${c('cyan', 'Output:')}`);
        if (typeof response.output === 'string') {
          console.log(response.output);
        } else {
          console.log(JSON.stringify(response.output, null, 2));
        }
      }
      
      if (response.summary) {
        console.log(`\n${c('dim', response.summary)}`);
      }
    } else {
      console.log(`${c('red', '❌ Task failed')}`);
      if (response.error) {
        console.log(`${c('red', 'Error:')} ${response.error.message}`);
      }
    }

    console.log(`\n${c('dim', `Duration: ${duration}ms`)}`);
    
  } catch (error) {
    console.error(`\n${c('red', '❌ Error:')} ${error}`);
    process.exit(1);
  }
}

// -------------------- Interactive Mode --------------------

async function runInteractive(options: CLIOptions): Promise<void> {
  const readline = await import('readline');
  
  console.log(`
${c('cyan', c('bold', '╔════════════════════════════════════════╗'))}
${c('cyan', '║')}     ${c('bold', 'Agent Core Interactive Mode')}      ${c('cyan', '║')}
${c('cyan', c('bold', '╚════════════════════════════════════════╝'))}

${c('dim', 'Type a task and press Enter. Commands:')}
  ${c('yellow', '/help')}    - Show help
  ${c('yellow', '/tools')}   - List tools
  ${c('yellow', '/exit')}    - Exit

${c('dim', `Using LLM: ${options.llm}`)}
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (): void => {
    rl.question(`${c('green', 'agent>')} `, async (input) => {
      const trimmed = input.trim();
      
      if (!trimmed) {
        prompt();
        return;
      }

      // Commands
      if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') {
        console.log(c('dim', 'Goodbye!'));
        rl.close();
        process.exit(0);
      }

      if (trimmed === '/help') {
        printHelp();
        prompt();
        return;
      }

      if (trimmed === '/tools') {
        listTools();
        prompt();
        return;
      }

      // Run task
      try {
        await runTask(trimmed, options);
      } catch (error) {
        console.error(c('red', `Error: ${error}`));
      }

      console.log('');
      prompt();
    });
  };

  prompt();
}

// -------------------- Parse Arguments --------------------

function parseArgs(args: string[]): { command: string; task: string; options: CLIOptions } {
  const options: CLIOptions = {
    llm: 'mock',
    verbose: false,
    maxSteps: 20,
    timeout: 60000,
    tools: []
  };

  let command = 'help';
  let task = '';
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case 'run':
        command = 'run';
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          task = args[i + 1];
          i++;
        }
        break;

      case 'interactive':
      case '-i':
        command = 'interactive';
        break;

      case 'list-tools':
      case 'tools':
        command = 'list-tools';
        break;

      case 'version':
      case '-V':
      case '--version':
        command = 'version';
        break;

      case 'help':
      case '-h':
      case '--help':
        command = 'help';
        break;

      case '--llm':
        if (args[i + 1]) {
          options.llm = args[i + 1] as CLIOptions['llm'];
          i++;
        }
        break;

      case '--model':
        if (args[i + 1]) {
          options.model = args[i + 1];
          i++;
        }
        break;

      case '-v':
      case '--verbose':
        options.verbose = true;
        break;

      case '--max-steps':
        if (args[i + 1]) {
          options.maxSteps = parseInt(args[i + 1], 10);
          i++;
        }
        break;

      case '--timeout':
        if (args[i + 1]) {
          options.timeout = parseInt(args[i + 1], 10);
          i++;
        }
        break;

      case '--tools':
        if (args[i + 1]) {
          options.tools = args[i + 1].split(',').map(t => t.trim());
          i++;
        }
        break;

      case '--ollama-url':
        if (args[i + 1]) {
          options.ollamaUrl = args[i + 1];
          i++;
        }
        break;

      default:
        // If no command yet and arg doesn't start with -, treat as task
        if (command === 'help' && !arg.startsWith('-')) {
          command = 'run';
          task = arg;
        }
    }

    i++;
  }

  return { command, task, options };
}

// -------------------- Main --------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, task, options } = parseArgs(args);

  switch (command) {
    case 'run':
      if (!task) {
        console.error(c('red', 'Error: No task specified'));
        console.log(c('dim', 'Usage: agent-core run "your task description"'));
        process.exit(1);
      }
      await runTask(task, options);
      break;

    case 'interactive':
      await runInteractive(options);
      break;

    case 'list-tools':
      listTools();
      break;

    case 'version':
      printVersion();
      break;

    case 'help':
    default:
      printHelp();
  }
}

// Run
main().catch(error => {
  console.error(c('red', `Fatal error: ${error}`));
  process.exit(1);
});
