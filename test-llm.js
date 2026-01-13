#!/usr/bin/env node
// ============================================
// Agent Core - LLM Integration Test (compiled)
// ============================================

const { createAgent, defaultTools } = require('./dist/index.js');
const { 
  createOpenAIClient, 
  createAnthropicClient,
  createOllamaClient,
  createGeminiClient,
  createMistralClient
} = require('./dist/llm/index.js');

// -------------------- Test Functions --------------------

async function testLLMDirect(name, createClient) {
  const start = Date.now();
  
  try {
    console.log(`\n🔄 Testing ${name} (direct)...`);
    
    const llm = createClient();
    const response = await llm.chat([
      { role: 'user', content: '请用一个词回答：天空是什么颜色？' }
    ]);
    
    const duration = Date.now() - start;
    console.log(`✅ ${name} - Success (${duration}ms)`);
    console.log(`   Response: ${response}`);
    
    return { provider: name, success: true, response, duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ ${name} - Failed: ${error.message}`);
    
    return { provider: name, success: false, error: error.message, duration };
  }
}

async function testAgentWithLLM(name, createClient) {
  const start = Date.now();
  
  try {
    console.log(`\n🔄 Testing Agent + ${name}...`);
    
    const llm = createClient();
    const agent = createAgent({
      llm,
      tools: defaultTools,
      plannerConfig: {
        model: 'gpt-4o-mini',
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
    
    const response = await agent.process('用calculate工具计算 2 + 3');
    const duration = Date.now() - start;
    
    const output = response.summary || response.output || 'No output';
    console.log(`✅ Agent + ${name} - Success (${duration}ms)`);
    console.log(`   Success: ${response.success}`);
    console.log(`   Steps: ${response.results?.length || 0}`);
    
    return { provider: `Agent+${name}`, success: response.success, response: String(output), duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ Agent + ${name} - Failed: ${error.message}`);
    
    return { provider: `Agent+${name}`, success: false, error: error.message, duration };
  }
}

// -------------------- Main --------------------

async function main() {
  const results = [];
  
  console.log('═'.repeat(50));
  console.log('Agent Core - LLM Integration Test');
  console.log('═'.repeat(50));
  
  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set (' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : '✗ Not set'}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log(`   MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log(`   OLLAMA_HOST: ${process.env.OLLAMA_HOST || 'http://localhost:11434 (default)'}`);
  
  // Test OpenAI
  if (process.env.OPENAI_API_KEY) {
    results.push(await testLLMDirect('OpenAI', () => 
      createOpenAIClient({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini'
      })
    ));
    
    results.push(await testAgentWithLLM('OpenAI', () => 
      createOpenAIClient({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini'
      })
    ));
  }
  
  // Test Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    results.push(await testLLMDirect('Anthropic', () => 
      createAnthropicClient({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307'
      })
    ));
  }
  
  // Test Gemini
  if (process.env.GEMINI_API_KEY) {
    results.push(await testLLMDirect('Gemini', () => 
      createGeminiClient({
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-pro'
      })
    ));
  }
  
  // Test Mistral
  if (process.env.MISTRAL_API_KEY) {
    results.push(await testLLMDirect('Mistral', () => 
      createMistralClient({
        apiKey: process.env.MISTRAL_API_KEY,
        model: 'mistral-small-latest'
      })
    ));
  }
  
  // Test Ollama (always try, it's local)
  results.push(await testLLMDirect('Ollama', () => 
    createOllamaClient({
      baseURL: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: 'llama3.2'
    })
  ));
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('Summary');
  console.log('═'.repeat(50));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (results.length > 0) {
    console.log('\nDetails:');
    for (const r of results) {
      const status = r.success ? '✅' : '❌';
      const info = r.success ? `${r.duration}ms` : (r.error || '').substring(0, 60);
      console.log(`  ${status} ${r.provider}: ${info}`);
    }
  }
  
  if (passed === 0) {
    console.log('\n⚠️  No LLM tests passed.');
    console.log('\n📝 To run tests, set API keys:');
    console.log('   export OPENAI_API_KEY="sk-..."');
    console.log('   export ANTHROPIC_API_KEY="sk-ant-..."');
    console.log('   export GEMINI_API_KEY="..."');
    console.log('   export MISTRAL_API_KEY="..."');
    console.log('\n   # Or start Ollama locally:');
    console.log('   ollama serve');
    console.log('   ollama pull llama3.2');
  }
  
  return passed > 0 ? 0 : 1;
}

main().then(code => process.exit(code)).catch(err => {
  console.error(err);
  process.exit(1);
});
