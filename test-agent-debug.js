#!/usr/bin/env node
// ============================================
// Agent Core - Agent Debug Test
// ============================================

const { createAgent, defaultTools } = require('./dist/index.js');
const { createOpenAIClient } = require('./dist/llm/index.js');

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY not set');
  process.exit(1);
}

async function main() {
  console.log('═'.repeat(50));
  console.log('Agent Debug Test');
  console.log('═'.repeat(50));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  const agent = createAgent({
    llm,
    tools: defaultTools,
    plannerConfig: {
      model: MODEL,
      maxSteps: 5,  // 减少步骤数
      enableParallel: false,
      confidenceThreshold: 0.7,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 30000,
      retryDelay: 1000,
      maxRetries: 1
    }
  });
  
  // 详细事件监听
  agent.on('status', (e) => console.log(`[Status] ${JSON.stringify(e)}`));
  agent.on('plan:created', (e) => {
    console.log(`[Plan Created] ${e.plan.steps.length} steps:`);
    e.plan.steps.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.name} (${s.type}) - tool: ${s.tool || 'N/A'}`);
    });
  });
  agent.on('step:start', (e) => console.log(`[Step Start] ${e.stepName || e.stepId}`));
  agent.on('step:complete', (e) => console.log(`[Step Complete] ${e.result?.stepName} - ${e.result?.status}`));
  agent.on('step:error', (e) => console.log(`[Step Error] ${e.result?.stepName}: ${e.error?.message}`));
  agent.on('task:complete', (e) => console.log(`[Task Complete] success: ${e.success}`));
  agent.on('task:error', (e) => console.log(`[Task Error] ${e.error?.message}`));
  
  console.log('\n--- Running simple task ---\n');
  
  try {
    // 使用更简单的任务，明确工具名称
    const response = await agent.process('使用 math_evaluate 工具计算表达式 "15 + 27"');
    
    console.log('\n--- Response ---');
    console.log('Success:', response.success);
    console.log('TaskId:', response.taskId);
    console.log('Duration:', response.duration, 'ms');
    console.log('Steps:', response.results?.length || 0);
    
    if (response.results) {
      console.log('\nStep Results:');
      response.results.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.stepName}: ${r.status}`);
        if (r.output) console.log(`     Output: ${JSON.stringify(r.output).substring(0, 100)}`);
        if (r.error) console.log(`     Error: ${r.error.message}`);
      });
    }
    
    if (response.error) {
      console.log('\nError:', response.error.message);
      console.log('Stack:', response.error.stack);
    }
    
    console.log('\nSummary:', response.summary || 'N/A');
    console.log('Output:', JSON.stringify(response.output)?.substring(0, 200) || 'N/A');
    
  } catch (err) {
    console.error('\nFatal Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

main();
