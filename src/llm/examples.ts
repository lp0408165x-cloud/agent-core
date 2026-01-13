// ============================================
// Agent Core - LLM Integration Examples
// ============================================

import {
  // LLM Clients
  createOpenAIClient,
  createAnthropicClient,
  createLLMClient,
  OpenAIClient,
  AnthropicClient,
  
  // Agent
  createAgent,
  createPersistentAgent,
  Agent,
  
  // Tools
  defaultTools,
  createTool,
  
  // Persistence
  MemoryStorageAdapter,
  
  // Types
  LLMMessage,
  AgentResponse
} from '../index';

// ============================================
// Example 1: OpenAI Integration
// ============================================

async function openAIExample() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Example 1: OpenAI Integration');
  console.log('='.repeat(60));

  // Create OpenAI client
  const openai = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4o-mini',
    defaultMaxTokens: 4096,
    defaultTemperature: 0.7
  });

  console.log('\n📌 Available Models:', openai.getAvailableModels());

  // Create agent with OpenAI
  const agent = createAgent({
    llm: openai,
    plannerConfig: {
      model: 'gpt-4o-mini',
      maxSteps: 15,
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
    tools: defaultTools
  });

  // Listen to events
  agent.on('plan:created', ({ plan }) => {
    console.log(`\n📋 Plan created with ${plan.steps.length} steps`);
  });

  agent.on('step:complete', ({ result }) => {
    console.log(`✅ ${result.stepName}: ${result.status}`);
  });

  // Process task
  console.log('\n🚀 Processing task...');
  
  try {
    const response = await agent.process(
      'Analyze the following data and create a summary report with key insights',
      {
        data: {
          sales: [100, 150, 200, 180, 220],
          months: ['Jan', 'Feb', 'Mar', 'Apr', 'May']
        }
      }
    );

    console.log('\n📊 Result:');
    console.log(`   Success: ${response.success}`);
    console.log(`   Duration: ${response.duration}ms`);

    // Show usage
    const usage = openai.getUsage();
    console.log('\n💰 Usage:');
    console.log(`   Prompt tokens: ${usage.promptTokens}`);
    console.log(`   Completion tokens: ${usage.completionTokens}`);
    console.log(`   Estimated cost: $${usage.estimatedCost?.toFixed(4)}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================
// Example 2: Anthropic Integration
// ============================================

async function anthropicExample() {
  console.log('\n' + '='.repeat(60));
  console.log('🧠 Example 2: Anthropic Integration');
  console.log('='.repeat(60));

  // Create Anthropic client
  const anthropic = createAnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
    model: 'claude-3-5-sonnet-20241022',
    defaultMaxTokens: 4096,
    defaultTemperature: 0.7
  });

  console.log('\n📌 Available Models:', anthropic.getAvailableModels());

  // Create agent with Anthropic
  const agent = createAgent({
    llm: anthropic,
    plannerConfig: {
      model: 'claude-3-5-sonnet-20241022',
      maxSteps: 15,
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
    tools: defaultTools
  });

  // Process CBP compliance task
  console.log('\n🚀 Processing CBP compliance check...');

  try {
    const response = await agent.process(
      'Check CBP compliance for tire import from Vietnam',
      {
        entryNumber: 'NMR-67472736',
        importer: 'PIONEER RUBBER INC',
        product: 'Passenger Vehicle Tires',
        origin: 'Vietnam',
        value: 26100
      }
    );

    console.log('\n📊 Result:');
    console.log(`   Success: ${response.success}`);
    console.log(`   Duration: ${response.duration}ms`);

    // Show usage
    const usage = anthropic.getUsage();
    console.log('\n💰 Usage:');
    console.log(`   Input tokens: ${usage.promptTokens}`);
    console.log(`   Output tokens: ${usage.completionTokens}`);
    console.log(`   Estimated cost: $${usage.estimatedCost?.toFixed(4)}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================
// Example 3: Provider Factory
// ============================================

async function factoryExample() {
  console.log('\n' + '='.repeat(60));
  console.log('🏭 Example 3: LLM Factory');
  console.log('='.repeat(60));

  // Create client via factory
  const client = createLLMClient({
    provider: 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4o-mini'
    },
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      retryOnRateLimit: true
    },
    cache: {
      enabled: true,
      ttl: 3600000,  // 1 hour
      maxSize: 100
    }
  });

  console.log(`\n📌 Provider: ${client.provider}`);
  console.log(`📌 Model: ${client.model}`);

  // Direct completion
  try {
    const response = await client.complete(
      'What are the key compliance requirements for importing tires from Vietnam?'
    );
    console.log('\n📝 Response preview:', response.substring(0, 200) + '...');
  } catch (error: any) {
    console.log('\n⚠️ Skipped (no API key):', error.message);
  }
}

// ============================================
// Example 4: JSON Mode
// ============================================

async function jsonModeExample() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 Example 4: JSON Mode');
  console.log('='.repeat(60));

  const openai = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4o-mini'
  });

  try {
    // Use JSON mode for structured output
    const result = await (openai as any).chatJSON<{
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
    }>([
      {
        role: 'user',
        content: 'Parse this invoice: "3 tires at $45 each, 2 rims at $120 each"'
      }
    ]);

    console.log('\n📊 Parsed Invoice:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.log('\n⚠️ Skipped (no API key):', error.message);
  }
}

// ============================================
// Example 5: Streaming
// ============================================

async function streamingExample() {
  console.log('\n' + '='.repeat(60));
  console.log('🌊 Example 5: Streaming');
  console.log('='.repeat(60));

  const openai = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4o-mini'
  });

  try {
    console.log('\n📝 Streaming response:\n');

    const stream = (openai as any).chatStream([
      { role: 'user', content: 'Write a haiku about customs compliance' }
    ]);

    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }

    console.log('\n');

  } catch (error: any) {
    console.log('\n⚠️ Skipped (no API key):', error.message);
  }
}

// ============================================
// Example 6: Multi-Provider Fallback
// ============================================

async function fallbackExample() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Example 6: Multi-Provider Fallback');
  console.log('='.repeat(60));

  // Import MultiProviderClient
  const { MultiProviderClient } = await import('../llm/factory');

  // Create primary and fallback clients
  const primary = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'primary-key',
    model: 'gpt-4o-mini'
  });

  const fallback = createAnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY || 'fallback-key',
    model: 'claude-3-5-haiku-20241022'
  });

  // Create multi-provider client
  const multiClient = new MultiProviderClient({
    primary,
    fallback
  });

  console.log('\n📌 Primary:', multiClient.provider);
  console.log('📌 Has fallback: true');

  // Create agent with fallback
  const agent = createAgent({
    llm: multiClient,
    plannerConfig: {
      model: 'multi',
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 15000,
      retryDelay: 1000,
      maxRetries: 2
    },
    tools: defaultTools
  });

  try {
    const response = await agent.process('Simple analysis task');
    console.log('\n✅ Task completed with:', response.success ? 'success' : 'failure');
  } catch (error: any) {
    console.log('\n⚠️ Both providers failed:', error.message);
  }
}

// ============================================
// Example 7: Usage Tracking
// ============================================

async function usageTrackingExample() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Example 7: Usage Tracking');
  console.log('='.repeat(60));

  const openai = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4o-mini'
  });

  // Simulate multiple calls
  const tasks = [
    'Summarize import regulations',
    'List required documents',
    'Calculate duty rates'
  ];

  console.log('\n🚀 Processing multiple tasks...\n');

  for (const task of tasks) {
    try {
      await openai.complete(task);
      console.log(`✅ Completed: ${task}`);
    } catch (error: any) {
      console.log(`⚠️ Skipped: ${task}`);
    }
  }

  // Show aggregated usage
  const usage = openai.getUsage();
  const history = openai.getCallHistory();

  console.log('\n📊 Usage Summary:');
  console.log(`   Total calls: ${history.length}`);
  console.log(`   Successful: ${history.filter(c => c.success).length}`);
  console.log(`   Total tokens: ${usage.totalTokens}`);
  console.log(`   Estimated cost: $${usage.estimatedCost?.toFixed(4) || '0.0000'}`);

  // Call history
  console.log('\n📜 Call History:');
  history.forEach((call, i) => {
    console.log(`   ${i + 1}. ${call.model} - ${call.duration}ms - ${call.success ? '✅' : '❌'}`);
  });

  // Reset for next session
  openai.resetUsage();
  console.log('\n🔄 Usage reset');
}

// ============================================
// Example 8: Custom CBP Tool with LLM
// ============================================

async function cbpToolExample() {
  console.log('\n' + '='.repeat(60));
  console.log('🛃 Example 8: CBP Tool with LLM');
  console.log('='.repeat(60));

  const openai = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4o-mini'
  });

  // Create custom tool that uses LLM
  const adCvdAnalyzer = createTool()
    .name('adcvd_analyzer')
    .description('Analyze AD/CVD requirements for imported goods')
    .category('cbp')
    .parameter({
      name: 'product',
      type: 'string',
      required: true,
      description: 'Product description'
    })
    .parameter({
      name: 'origin',
      type: 'string',
      required: true,
      description: 'Country of origin'
    })
    .returns('object')
    .execute(async (params) => {
      const prompt = `
Analyze AD/CVD requirements for:
- Product: ${params.product}
- Origin: ${params.origin}

Respond with JSON containing:
- caseNumber: string (if applicable)
- dutyRate: string
- riskLevel: "low" | "medium" | "high"
- requirements: string[]
`;

      try {
        const response = await openai.complete(prompt);
        // Try to parse as JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return { raw: response };
      } catch (error) {
        return {
          error: 'Analysis failed',
          product: params.product,
          origin: params.origin
        };
      }
    })
    .build();

  // Create agent with custom tool
  const agent = createAgent({
    llm: openai,
    plannerConfig: {
      model: 'gpt-4o-mini',
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 30000,
      retryDelay: 1000,
      maxRetries: 2
    },
    tools: [...defaultTools, adCvdAnalyzer]
  });

  console.log('\n📌 Custom tool registered: adcvd_analyzer');

  try {
    const response = await agent.process(
      'Use the AD/CVD analyzer to check requirements for passenger tires from Vietnam'
    );
    console.log('\n✅ Analysis complete');
  } catch (error: any) {
    console.log('\n⚠️ Skipped:', error.message);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Agent Core - LLM Integration Examples            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  console.log('\n📌 API Keys:');
  console.log(`   OPENAI_API_KEY: ${hasOpenAI ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ANTHROPIC_API_KEY: ${hasAnthropic ? '✅ Set' : '❌ Not set'}`);

  if (!hasOpenAI && !hasAnthropic) {
    console.log('\n⚠️  No API keys found. Set environment variables to run examples:');
    console.log('   export OPENAI_API_KEY=your-key');
    console.log('   export ANTHROPIC_API_KEY=your-key');
    console.log('\n   Running in demo mode (some examples will be skipped)...');
  }

  try {
    await openAIExample();
    await anthropicExample();
    await factoryExample();
    await jsonModeExample();
    await streamingExample();
    await fallbackExample();
    await usageTrackingExample();
    await cbpToolExample();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All examples completed!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Example error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  openAIExample,
  anthropicExample,
  factoryExample,
  jsonModeExample,
  streamingExample,
  fallbackExample,
  usageTrackingExample,
  cbpToolExample
};
