// ============================================
// CBP Compliance - Agent Configuration
// ============================================

import {
  createAgent,
  createPersistentAgent,
  defaultTools,
  Agent,
  PersistentAgent,
  LLMClient
} from '../../src';
import { cbpTools } from './tools';

// -------------------- System Prompts --------------------

export const CBP_SYSTEM_PROMPT = `You are a CBP (Customs and Border Protection) Compliance Agent.

Your role is to assist with customs compliance checks, document analysis, and entry preparation.

## Capabilities
- Extract and analyze trade documents (invoices, packing lists, B/L, C/O)
- Cross-validate documents for consistency
- Check AD/CVD (Antidumping/Countervailing Duty) applicability
- Calculate duties, fees, and total costs
- Identify compliance issues and risks
- Generate detailed compliance reports

## Key Regulations
- 19 CFR 141 - Entry of Merchandise
- 19 CFR 152 - Classification and Appraisement
- 19 USC 1673/1671 - AD/CVD Laws
- USMCA/Other FTA Rules of Origin

## Process
1. Collect and verify all required documents
2. Extract key data from each document
3. Cross-validate information across documents
4. Check for AD/CVD applicability
5. Calculate duties and fees
6. Perform comprehensive compliance check
7. Generate findings report with recommendations

Always provide accurate, detailed analysis and cite relevant regulations.
When issues are found, provide clear remediation steps.`;

// -------------------- Agent Factory --------------------

export interface CBPAgentConfig {
  llm: LLMClient;
  persistent?: boolean;
  storageDir?: string;
  verbose?: boolean;
}

/**
 * Create a CBP Compliance Agent
 */
export function createCBPAgent(config: CBPAgentConfig): Agent | PersistentAgent {
  const { llm, persistent = false, storageDir, verbose = false } = config;

  // Combine default tools with CBP-specific tools
  const allTools = [...defaultTools, ...cbpTools];

  const baseConfig = {
    llm,
    plannerConfig: {
      model: 'cbp-compliance',
      maxSteps: 20,
      enableParallel: false, // Sequential for compliance workflows
      confidenceThreshold: 0.85,
      planningTimeout: 60000,
      systemPrompt: CBP_SYSTEM_PROMPT
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 30000,
      retryDelay: 2000,
      maxRetries: 2
    },
    tools: allTools
  };

  let agent: Agent | PersistentAgent;

  if (persistent) {
    agent = createPersistentAgent({
      ...baseConfig,
      persistenceConfig: {
        autoSave: true,
        saveInterval: 5000,
        storageType: 'file',
        storageOptions: {
          basePath: storageDir || './cbp-data'
        }
      }
    });
  } else {
    agent = createAgent(baseConfig);
  }

  // Add verbose logging if enabled
  if (verbose) {
    agent.on('status', ({ state }) => {
      console.log(`[Agent] State: ${state}`);
    });

    agent.on('plan:created', ({ plan }) => {
      console.log(`[Agent] Plan created with ${plan.steps.length} steps:`);
      plan.steps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.name}`);
      });
    });

    agent.on('step:start', ({ stepId, stepName }) => {
      console.log(`[Agent] Starting: ${stepName}`);
    });

    agent.on('step:complete', ({ result }) => {
      const status = result.status === 'completed' ? '✅' : '❌';
      console.log(`[Agent] ${status} Completed: ${result.stepName}`);
    });

    agent.on('error', ({ error }) => {
      console.error(`[Agent] Error:`, error);
    });
  }

  return agent;
}

// -------------------- Mock LLM for Demo --------------------

/**
 * Create a mock LLM for demonstration
 */
export function createMockCBPLLM(): LLMClient {
  return {
    async complete(prompt: string): Promise<string> {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate plan for compliance check
      if (prompt.includes('plan') || prompt.includes('analyze')) {
        return JSON.stringify({
          steps: [
            {
              id: 'step_1',
              name: 'Extract Commercial Invoice',
              tool: 'extract_invoice',
              params: { filePath: 'invoice.pdf' },
              dependencies: []
            },
            {
              id: 'step_2',
              name: 'Extract Packing List',
              tool: 'extract_packing_list',
              params: { filePath: 'packing_list.pdf' },
              dependencies: []
            },
            {
              id: 'step_3',
              name: 'Extract Bill of Lading',
              tool: 'extract_bill_of_lading',
              params: { filePath: 'bill_of_lading.pdf' },
              dependencies: []
            },
            {
              id: 'step_4',
              name: 'Extract Certificate of Origin',
              tool: 'extract_certificate_of_origin',
              params: { filePath: 'certificate_of_origin.pdf' },
              dependencies: []
            },
            {
              id: 'step_5',
              name: 'Cross-Validate Documents',
              tool: 'cross_validate_documents',
              params: {
                invoice: '{{step_1.output}}',
                packingList: '{{step_2.output}}',
                billOfLading: '{{step_3.output}}'
              },
              dependencies: ['step_1', 'step_2', 'step_3']
            },
            {
              id: 'step_6',
              name: 'Check AD/CVD Applicability',
              tool: 'check_adcvd_case',
              params: {
                hsCode: '{{step_1.output.items[0].hsCode}}',
                countryOfOrigin: '{{step_1.output.seller.country}}',
                productDescription: '{{step_1.output.items[0].description}}'
              },
              dependencies: ['step_1']
            },
            {
              id: 'step_7',
              name: 'Calculate Duties',
              tool: 'calculate_duties',
              params: {
                enteredValue: '{{step_1.output.total}}',
                hsCode: '{{step_1.output.items[0].hsCode}}',
                adcvdCases: '{{step_6.output.cases}}'
              },
              dependencies: ['step_1', 'step_6']
            },
            {
              id: 'step_8',
              name: 'Perform Compliance Check',
              tool: 'compliance_check',
              params: {
                entryNumber: 'NMR-67472736',
                documents: {
                  invoice: '{{step_1.output}}',
                  packingList: '{{step_2.output}}',
                  billOfLading: '{{step_3.output}}',
                  certificateOfOrigin: '{{step_4.output}}'
                },
                validation: '{{step_5.output}}',
                adcvdInfo: '{{step_6.output}}'
              },
              dependencies: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6']
            },
            {
              id: 'step_9',
              name: 'Generate Compliance Report',
              tool: 'generate_report',
              params: {
                entryNumber: 'NMR-67472736',
                complianceResult: '{{step_8.output}}',
                documents: {
                  invoice: '{{step_1.output}}',
                  packingList: '{{step_2.output}}'
                },
                dutyCalculation: '{{step_7.output}}'
              },
              dependencies: ['step_7', 'step_8']
            }
          ],
          confirmationPoints: [
            {
              afterStep: 'step_5',
              question: 'Documents validated. Continue with AD/CVD check?'
            },
            {
              afterStep: 'step_8',
              question: 'Compliance check complete. Generate final report?'
            }
          ]
        });
      }
      
      return 'Task analysis complete.';
    },
    
    async chat(messages: any[]): Promise<string> {
      return this.complete(messages[messages.length - 1]?.content || '');
    }
  };
}

export default createCBPAgent;
