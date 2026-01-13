// ============================================
// Agent Core - Persistence Examples
// ============================================

import {
  createPersistentAgent,
  createStorageAdapter,
  PersistentAgent,
  MemoryStorageAdapter,
  FileStorageAdapter,
  defaultTools,
  LLMClient,
  LLMMessage,
  PersistedTask,
  Checkpoint
} from './index';

// ============================================
// Example 1: Basic Persistent Agent
// ============================================

async function basicPersistentAgentExample() {
  // Create a mock LLM client
  const llm: LLMClient = {
    async complete(prompt: string) {
      // Mock response
      return JSON.stringify([
        { id: 'step_1', type: 'tool', name: 'Read File', tool: 'file_read', params: { path: '/data.txt' } },
        { id: 'step_2', type: 'llm', name: 'Analyze', params: { prompt: 'Analyze: {{step_1}}' } }
      ]);
    },
    async chat(messages: LLMMessage[]) {
      return 'Chat response';
    }
  };

  // Create agent with memory storage
  const agent = createPersistentAgent({
    llm,
    plannerConfig: {
      model: 'gpt-4',
      maxSteps: 20,
      enableParallel: true,
      confidenceThreshold: 0.8,
      planningTimeout: 60000
    },
    executorConfig: {
      maxConcurrency: 3,
      defaultTimeout: 30000,
      retryDelay: 1000,
      maxRetries: 3
    },
    tools: defaultTools,
    persistence: {
      adapter: new MemoryStorageAdapter(),
      keyPrefix: 'myapp:',
      enableAutoSave: true,
      checkpointInterval: 10000
    },
    autoCheckpoint: true,
    checkpointOnStep: true
  });

  // Initialize persistence
  await agent.initialize();

  // Listen to persistence events
  agent.on('checkpoint:created', ({ checkpoint }) => {
    console.log(`✓ Checkpoint created: ${checkpoint.id}`);
  });

  agent.on('task:resumed', ({ taskId, fromStep }) => {
    console.log(`↻ Task resumed from step ${fromStep}`);
  });

  // Process a task
  const response = await agent.process('Analyze the uploaded document');
  console.log('Task completed:', response.taskId);

  // Shutdown
  await agent.shutdown();
}

// ============================================
// Example 2: File-based Persistence
// ============================================

async function filePersistenceExample() {
  const agent = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: {
      adapter: new FileStorageAdapter('/tmp/agent-data'),
      keyPrefix: 'agent:',
      checkpointRetention: 24 * 60 * 60 * 1000,  // 24 hours
      historyRetention: 7 * 24 * 60 * 60 * 1000  // 7 days
    }
  });

  await agent.initialize();

  // Process task
  const response = await agent.process('Generate weekly report');
  
  console.log('Task ID:', response.taskId);
  console.log('Success:', response.success);

  // List all tasks
  const tasks = await agent.listTasks({ limit: 10 });
  console.log(`Total tasks: ${tasks.length}`);

  // Get task history
  if (response.taskId) {
    const history = await agent.getTaskHistory(response.taskId);
    console.log(`Execution records: ${history.length}`);
  }

  await agent.shutdown();
}

// ============================================
// Example 3: Task Resume
// ============================================

async function taskResumeExample() {
  const storage = new MemoryStorageAdapter();
  
  // First agent instance - starts task
  const agent1 = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: { adapter: storage }
  });

  await agent1.initialize();

  // Start a long-running task
  console.log('Starting task...');
  
  // Simulate interruption after some steps
  const taskPromise = agent1.process('Process 100 files');
  
  // Let it run for a bit, then cancel
  setTimeout(() => {
    console.log('Simulating interruption...');
    agent1.cancel();
  }, 2000);

  try {
    await taskPromise;
  } catch (e) {
    console.log('Task interrupted');
  }

  const currentTaskId = agent1.currentTask!;
  await agent1.shutdown();

  // Second agent instance - resumes task
  console.log('\nResuming task...');
  
  const agent2 = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: { adapter: storage }
  });

  await agent2.initialize();

  // Check if task can be resumed
  const resumeInfo = await agent2.persistenceManager.canResumeTask(currentTaskId);
  
  if (resumeInfo.canResume) {
    console.log(`Can resume from checkpoint: ${resumeInfo.checkpoint?.id}`);
    const response = await agent2.resumeTask(currentTaskId);
    console.log('Resume result:', response.success);
  } else {
    console.log('Cannot resume:', resumeInfo.reason);
  }

  await agent2.shutdown();
}

// ============================================
// Example 4: Query Tasks and History
// ============================================

async function queryExample() {
  const agent = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: { adapter: new MemoryStorageAdapter() }
  });

  await agent.initialize();

  // Create some tasks
  await agent.process('Task 1');
  await agent.process('Task 2');
  await agent.process('Task 3');

  // Query completed tasks
  const completedTasks = await agent.listTasks({
    status: 'completed',
    limit: 10
  });
  console.log(`Completed tasks: ${completedTasks.length}`);

  // Query failed tasks
  const failedTasks = await agent.listTasks({
    status: 'failed',
    limit: 10
  });
  console.log(`Failed tasks: ${failedTasks.length}`);

  // Get statistics
  const stats = await agent.getStatistics();
  console.log('Statistics:', stats);

  // Get task by ID
  if (completedTasks.length > 0) {
    const task = await agent.loadTask(completedTasks[0].id);
    console.log('Task details:', task?.description);
  }

  await agent.shutdown();
}

// ============================================
// Example 5: Plan Versioning
// ============================================

async function planVersioningExample() {
  const agent = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: { ...defaultPlannerConfig(), enableParallel: true },
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: { adapter: new MemoryStorageAdapter() }
  });

  await agent.initialize();

  // Process task (will create plan)
  const response = await agent.process('Complex multi-step task');

  // Get plan versions
  const versions = await agent.getPlanVersions(response.taskId);
  
  console.log(`Plan versions: ${versions.length}`);
  versions.forEach(v => {
    console.log(`  v${v.version}: ${v.reason} (${v.plan.steps.length} steps)`);
  });

  await agent.shutdown();
}

// ============================================
// Example 6: Checkpoints
// ============================================

async function checkpointExample() {
  const agent = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: { 
      adapter: new MemoryStorageAdapter(),
      checkpointInterval: 5000  // Every 5 seconds
    },
    checkpointOnStep: true
  });

  await agent.initialize();

  // Listen for checkpoints
  agent.on('checkpoint:created', ({ checkpoint }: { checkpoint: Checkpoint }) => {
    console.log(`Checkpoint: step ${checkpoint.stepIndex}, can resume: ${checkpoint.canResume}`);
  });

  // Process task
  await agent.process('Multi-step analysis');

  // Get all checkpoints for the task
  const checkpoints = await agent.getCheckpoints();
  console.log(`Total checkpoints: ${checkpoints.length}`);

  // Find resumable checkpoints
  const resumable = checkpoints.filter(c => c.canResume);
  console.log(`Resumable checkpoints: ${resumable.length}`);

  await agent.shutdown();
}

// ============================================
// Example 7: Browser Storage (IndexedDB)
// ============================================

async function browserStorageExample() {
  // This would run in a browser environment
  
  const agent = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: {
      adapter: createStorageAdapter({
        type: 'indexedDB',
        dbName: 'MyAgentApp',
        storeName: 'tasks'
      })
    }
  });

  await agent.initialize();

  // Tasks will be persisted in IndexedDB
  await agent.process('Browser-based task');

  // Even after page refresh, tasks can be resumed
  const tasks = await agent.listTasks();
  console.log(`Persisted tasks: ${tasks.length}`);

  await agent.shutdown();
}

// ============================================
// Example 8: Cleanup and Maintenance
// ============================================

async function cleanupExample() {
  const agent = createPersistentAgent({
    llm: createMockLLM(),
    plannerConfig: defaultPlannerConfig(),
    executorConfig: defaultExecutorConfig(),
    tools: defaultTools,
    persistence: {
      adapter: new MemoryStorageAdapter(),
      checkpointRetention: 1000,  // 1 second for demo
      historyRetention: 2000      // 2 seconds for demo
    }
  });

  await agent.initialize();

  // Create some data
  await agent.process('Task 1');
  await agent.process('Task 2');

  console.log('Before cleanup:');
  console.log(await agent.getStatistics());

  // Wait for data to expire
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Run cleanup
  await agent.cleanup();

  console.log('After cleanup:');
  console.log(await agent.getStatistics());

  await agent.shutdown();
}

// ============================================
// Helper Functions
// ============================================

function createMockLLM(): LLMClient {
  return {
    async complete(prompt: string) {
      // Simple mock that returns a basic plan
      if (prompt.includes('分析') || prompt.includes('Analyze')) {
        return JSON.stringify({
          taskType: 'analysis',
          resources: ['file'],
          outputFormat: 'report',
          risks: [],
          confirmationPoints: [],
          complexity: 'medium'
        });
      }
      
      return JSON.stringify([
        { id: 'step_1', type: 'llm', name: 'Process', params: { prompt: 'Process data' } }
      ]);
    },
    async chat(messages: LLMMessage[]) {
      return 'Response';
    }
  };
}

function defaultPlannerConfig() {
  return {
    model: 'gpt-4',
    maxSteps: 20,
    enableParallel: true,
    confidenceThreshold: 0.8,
    planningTimeout: 60000
  };
}

function defaultExecutorConfig() {
  return {
    maxConcurrency: 3,
    defaultTimeout: 30000,
    retryDelay: 1000,
    maxRetries: 3
  };
}

// ============================================
// Run Examples
// ============================================

// Uncomment to run:
// basicPersistentAgentExample();
// filePersistenceExample();
// taskResumeExample();
// queryExample();
// planVersioningExample();
// checkpointExample();
// browserStorageExample();
// cleanupExample();

export {
  basicPersistentAgentExample,
  filePersistenceExample,
  taskResumeExample,
  queryExample,
  planVersioningExample,
  checkpointExample,
  browserStorageExample,
  cleanupExample
};
