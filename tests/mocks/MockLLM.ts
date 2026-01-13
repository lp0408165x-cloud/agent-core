// ============================================
// Agent Core - Mock LLM for Testing
// ============================================

import { LLMClient, LLMMessage, LLMCompletionOptions } from '../src/types';

interface MockResponse {
  pattern: RegExp;
  response: string | ((prompt: string) => string);
}

export class MockLLM implements LLMClient {
  private responses: MockResponse[] = [];
  private callHistory: Array<{ method: string; input: any; output: string }> = [];
  private defaultDelay: number = 100;

  constructor(options?: { delay?: number }) {
    this.defaultDelay = options?.delay ?? 100;
    this.setupDefaultResponses();
  }

  // -------------------- Default Responses --------------------

  private setupDefaultResponses(): void {
    // Task analysis response
    this.addResponse(/分析|analyze|analysis/i, () => JSON.stringify({
      taskType: 'document',
      resources: ['pdf', 'excel'],
      outputFormat: 'report',
      risks: ['Missing documentation', 'Data inconsistency'],
      confirmationPoints: ['Document verification', 'Final review'],
      complexity: 'high'
    }));

    // Plan generation for document analysis
    this.addResponse(/读取.*文件|read.*file|extract/i, () => JSON.stringify([
      {
        id: 'step_1',
        type: 'tool',
        name: '读取文档',
        description: '提取PDF/Excel文件内容',
        tool: 'file_read',
        params: { path: '{{context.filePath}}' },
        retryable: true,
        timeout: 30000
      },
      {
        id: 'step_2',
        type: 'llm',
        name: '解析内容',
        description: '分析文档结构和关键信息',
        params: { prompt: '分析以下内容: {{step_1}}' },
        dependsOn: ['step_1']
      },
      {
        id: 'step_3',
        type: 'llm',
        name: '生成报告',
        description: '生成分析报告',
        params: { prompt: '根据分析结果生成报告' },
        dependsOn: ['step_2']
      }
    ]));

    // CBP compliance check plan
    this.addResponse(/CBP|合规|compliance|检查|check/i, () => JSON.stringify([
      {
        id: 'step_1',
        type: 'tool',
        name: '读取商业发票',
        tool: 'file_read',
        params: { path: '{{context.invoicePath}}' },
        retryable: true
      },
      {
        id: 'step_2',
        type: 'tool',
        name: '读取装箱单',
        tool: 'file_read',
        params: { path: '{{context.packingListPath}}' },
        retryable: true
      },
      {
        id: 'step_3',
        type: 'llm',
        name: '交叉验证',
        description: '验证发票和装箱单一致性',
        params: { 
          prompt: '对比以下文档，检查数量、金额、产品描述是否一致:\n发票: {{step_1}}\n装箱单: {{step_2}}' 
        },
        dependsOn: ['step_1', 'step_2']
      },
      {
        id: 'step_4',
        type: 'llm',
        name: 'AD/CVD评估',
        description: '评估反倾销/反补贴风险',
        params: { prompt: '评估AD/CVD合规性' },
        dependsOn: ['step_3']
      },
      {
        id: 'step_5',
        type: 'llm',
        name: '生成合规报告',
        description: '生成CBP合规检查报告',
        params: { prompt: '生成最终合规报告' },
        dependsOn: ['step_4'],
        needConfirmation: true
      }
    ]));

    // Document extraction response
    this.addResponse(/提取|extract|parse/i, (prompt) => {
      if (prompt.includes('invoice') || prompt.includes('发票')) {
        return JSON.stringify({
          invoiceNumber: 'CI-CLDT2509-1',
          date: '2024-11-15',
          seller: 'Vietnam Tire Co.',
          buyer: 'PIONEER RUBBER INC',
          items: [
            { description: 'Radial Tires', quantity: 500, unitPrice: 45.00, total: 22500.00 }
          ],
          totalAmount: 22500.00,
          currency: 'USD',
          incoterms: 'DDP'
        });
      }
      return 'Extracted content from document';
    });

    // Compliance analysis response
    this.addResponse(/对比|compare|验证|verify/i, () => JSON.stringify({
      matches: {
        productDescription: true,
        quantity: true,
        value: true,
        shipper: true
      },
      discrepancies: [],
      riskLevel: 'low',
      recommendation: 'Documents are consistent'
    }));

    // AD/CVD assessment
    this.addResponse(/AD\/CVD|反倾销|antidumping/i, () => JSON.stringify({
      productScope: 'Passenger Vehicle and Light Truck Tires from Vietnam',
      caseNumber: 'A-552-822',
      dutyRate: '0% (if from cooperating exporter)',
      riskFactors: [
        'DDP transaction structure requires documented evidence of ultimate consignee',
        'Need proof of payment flow from importer to exporter',
        'Certificate of Origin must match commercial invoice'
      ],
      requiredDocuments: [
        'Commercial Invoice with DDP terms',
        'Packing List',
        'Bill of Lading',
        'Certificate of Origin (Form B)',
        'Payment records',
        'Entry Summary (CF-7501)'
      ],
      complianceStatus: 'Under Review'
    }));

    // Report generation
    this.addResponse(/报告|report|生成|generate/i, () => `
# CBP合规检查报告

## 案件信息
- Entry Number: NMR-67472736
- Importer: PIONEER RUBBER INC
- Product: Passenger Vehicle Tires from Vietnam

## 文档检查结果
| 文档 | 状态 | 备注 |
|------|------|------|
| Commercial Invoice | ✓ | CI-CLDT2509-1 |
| Packing List | ✓ | PL-CLDT2509-1 |
| Bill of Lading | ✓ | CTASO5091443 |
| Certificate of Origin | ✓ | VN-US 25/01/074565B |

## AD/CVD评估
- 案件编号: A-552-822
- 税率: 待确认
- 风险等级: 中等

## 建议行动
1. 完善付款证明链条
2. 确认DDP交易结构文档完整
3. 准备18点问卷回复

## 结论
文档基本完整，需补充付款证明相关材料。
`);

    // Default fallback
    this.addResponse(/.*/, 'Task completed successfully');
  }

  // -------------------- Response Management --------------------

  addResponse(pattern: RegExp, response: string | ((prompt: string) => string)): void {
    this.responses.unshift({ pattern, response }); // Add to front for priority
  }

  clearResponses(): void {
    this.responses = [];
    this.setupDefaultResponses();
  }

  // -------------------- LLM Interface --------------------

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    // Check abort signal
    if (options?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    // Simulate delay
    await this.delay();

    // Find matching response
    const response = this.findResponse(prompt);

    // Record call
    this.callHistory.push({
      method: 'complete',
      input: prompt.substring(0, 200),
      output: response.substring(0, 200)
    });

    return response;
  }

  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    // Check abort signal
    if (options?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    // Simulate delay
    await this.delay();

    // Use last user message for matching
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const prompt = lastUserMessage?.content || '';
    const response = this.findResponse(prompt);

    // Record call
    this.callHistory.push({
      method: 'chat',
      input: messages,
      output: response.substring(0, 200)
    });

    return response;
  }

  // -------------------- Helpers --------------------

  private findResponse(prompt: string): string {
    for (const { pattern, response } of this.responses) {
      if (pattern.test(prompt)) {
        return typeof response === 'function' ? response(prompt) : response;
      }
    }
    return 'No matching response found';
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.defaultDelay));
  }

  // -------------------- Test Utilities --------------------

  getCallHistory(): Array<{ method: string; input: any; output: string }> {
    return [...this.callHistory];
  }

  getCallCount(): number {
    return this.callHistory.length;
  }

  clearHistory(): void {
    this.callHistory = [];
  }

  wasCalledWith(pattern: RegExp): boolean {
    return this.callHistory.some(call => {
      const input = typeof call.input === 'string' ? call.input : JSON.stringify(call.input);
      return pattern.test(input);
    });
  }
}

// -------------------- Factory --------------------

export function createMockLLM(options?: { delay?: number }): MockLLM {
  return new MockLLM(options);
}
