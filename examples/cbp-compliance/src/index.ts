// ============================================
// CBP Compliance - Main Entry Point
// ============================================

import { createCBPAgent, createMockCBPLLM } from './agent';
import { cbpTools } from './tools';

// Re-export everything
export * from './types';
export * from './tools';
export * from './agent';

// -------------------- Quick Demo --------------------

async function demo() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          CBP Compliance Agent - Demo                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Create mock LLM
  const llm = createMockCBPLLM();

  // Create agent
  const agent = createCBPAgent({
    llm,
    verbose: true
  });

  console.log('📋 Entry Number: NMR-67472736');
  console.log('📦 Product: Passenger Vehicle Tires from Vietnam');
  console.log('💰 Value: $28,100');
  console.log('');
  console.log('Starting compliance check...');
  console.log('─'.repeat(60));

  try {
    // Run compliance check
    const response = await agent.process(
      'Perform comprehensive compliance check for CBP entry NMR-67472736',
      {
        entryNumber: 'NMR-67472736',
        documents: {
          invoice: 'invoice.pdf',
          packingList: 'packing_list.pdf',
          billOfLading: 'bill_of_lading.pdf',
          certificateOfOrigin: 'certificate_of_origin.pdf'
        }
      }
    );

    console.log('');
    console.log('═'.repeat(60));
    console.log('                      RESULTS');
    console.log('═'.repeat(60));
    console.log('');

    if (response.success) {
      console.log('✅ Compliance check completed successfully');
      console.log(`⏱️  Duration: ${response.duration}ms`);
      console.log(`📊 Steps executed: ${response.stepResults?.length || 0}`);
      console.log('');

      // Show final report if available
      if (typeof response.result === 'string') {
        console.log(response.result);
      } else {
        console.log(JSON.stringify(response.result, null, 2));
      }
    } else {
      console.log('❌ Compliance check failed');
      console.log(`Error: ${response.error}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log('Demo completed');
  console.log('');
}

// Run demo if executed directly
if (require.main === module) {
  demo();
}

export { demo };
