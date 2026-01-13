#!/usr/bin/env node
// ============================================
// Agent Core - OpenAI Integration Test
// ============================================

const { createAgent, defaultTools } = require('./dist/index.js');
const { createOpenAIClient } = require('./dist/llm/index.js');

// -------------------- Config --------------------

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY not set');
  console.log('\nUsage:');
  console.log('  export OPENAI_API_KEY="sk-..."');
  console.log('  node test-openai.js');
  process.exit(1);
}

// -------------------- Tests --------------------

async function test1_DirectChat() {
  console.log('\n📝 Test 1: Direct Chat');
  console.log('─'.repeat(40));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  const response = await llm.chat([
    { role: 'user', content: '用一个词回答：1+1=?' }
  ]);
  
  console.log(`✅ Response: ${response}`);
  console.log(`   Usage: ${JSON.stringify(llm.getUsage())}`);
  
  return true;
}

async function test2_SystemPrompt() {
  console.log('\n📝 Test 2: System Prompt');
  console.log('─'.repeat(40));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  const response = await llm.chatWithSystem(
    '你是一个只说中文的助手，回答要简洁。',
    [{ role: 'user', content: 'What is the capital of France?' }]
  );
  
  console.log(`✅ Response: ${response}`);
  
  return true;
}

async function test3_JSONMode() {
  console.log('\n📝 Test 3: JSON Mode');
  console.log('─'.repeat(40));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  const result = await llm.chatJSON([
    { role: 'user', content: '返回一个JSON对象，包含name和age字段，值随意' }
  ]);
  
  console.log(`✅ Response:`, result);
  console.log(`   Type: ${typeof result}`);
  console.log(`   Has name: ${result.name !== undefined}`);
  
  return typeof result === 'object' && result.name !== undefined;
}

async function test4_Streaming() {
  console.log('\n📝 Test 4: Streaming');
  console.log('─'.repeat(40));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  process.stdout.write('✅ Response: ');
  
  let fullResponse = '';
  for await (const chunk of llm.chatStream([
    { role: 'user', content: '写三个水果名称，用逗号分隔' }
  ])) {
    process.stdout.write(chunk);
    fullResponse += chunk;
  }
  console.log();
  
  return fullResponse.length > 0;
}

async function test5_AgentIntegration() {
  console.log('\n📝 Test 5: Agent Integration');
  console.log('─'.repeat(40));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  const agent = createAgent({
    llm,
    tools: defaultTools,
    plannerConfig: {
      model: MODEL,
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.7,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 3,
      defaultTimeout: 30000,
      retryDelay: 1000,
      maxRetries: 2
    }
  });
  
  // Listen to events
  agent.on('step:start', (e) => console.log(`   → Step: ${e.step?.name || 'unknown'}`));
  agent.on('step:complete', (e) => console.log(`   ✓ Done: ${e.result?.stepName || 'unknown'}`));
  
  console.log('   Processing task...');
  const response = await agent.process('分析一下数字 42 有什么特别之处');
  
  console.log(`✅ Success: ${response.success}`);
  console.log(`   Steps: ${response.results?.length || 0}`);
  console.log(`   Summary: ${(response.summary || response.output || '').substring(0, 100)}...`);
  
  return response.success;
}

async function test6_ErrorHandling() {
  console.log('\n📝 Test 6: Error Handling');
  console.log('─'.repeat(40));
  
  // Test with invalid API key
  const badLLM = createOpenAIClient({ apiKey: 'sk-invalid', model: MODEL });
  
  try {
    await badLLM.chat([{ role: 'user', content: 'test' }]);
    console.log('❌ Should have thrown error');
    return false;
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message.substring(0, 50)}...`);
    console.log(`   Status: ${error.status}`);
    console.log(`   Is auth error: ${error.isAuthError?.() || false}`);
    return true;
  }
}

async function test7_UsageTracking() {
  console.log('\n📝 Test 7: Usage Tracking');
  console.log('─'.repeat(40));
  
  const llm = createOpenAIClient({ apiKey: API_KEY, model: MODEL });
  
  // Make multiple calls
  await llm.chat([{ role: 'user', content: '说"你好"' }]);
  await llm.chat([{ role: 'user', content: '说"再见"' }]);
  
  const usage = llm.getUsage();
  const history = llm.getCallHistory();
  
  console.log(`✅ Total tokens: ${usage.totalTokens}`);
  console.log(`   Prompt tokens: ${usage.promptTokens}`);
  console.log(`   Completion tokens: ${usage.completionTokens}`);
  console.log(`   Estimated cost: $${usage.estimatedCost?.toFixed(6) || 0}`);
  console.log(`   Call count: ${history.length}`);
  
  return usage.totalTokens > 0 && history.length === 2;
}

// -------------------- Main --------------------

async function main() {
  console.log('═'.repeat(50));
  console.log('Agent Core - OpenAI Integration Test');
  console.log('═'.repeat(50));
  console.log(`\nAPI Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`Model: ${MODEL}`);
  
  const tests = [
    { name: 'Direct Chat', fn: test1_DirectChat },
    { name: 'System Prompt', fn: test2_SystemPrompt },
    { name: 'JSON Mode', fn: test3_JSONMode },
    { name: 'Streaming', fn: test4_Streaming },
    { name: 'Agent Integration', fn: test5_AgentIntegration },
    { name: 'Error Handling', fn: test6_ErrorHandling },
    { name: 'Usage Tracking', fn: test7_UsageTracking },
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed, error: null });
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('Summary');
  console.log('═'.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  console.log('\nDetails:');
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    const info = r.error ? ` - ${r.error.substring(0, 40)}` : '';
    console.log(`  ${status} ${r.name}${info}`);
  }
  
  // Cost estimate
  console.log('\n💰 Note: Tests used ~500-1000 tokens (~$0.001 with gpt-4o-mini)');
  
  return failed === 0 ? 0 : 1;
}

main().then(code => process.exit(code)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
