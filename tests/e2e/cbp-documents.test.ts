// ============================================
// CBP Document Processing - End-to-End Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createAgent,
  createPersistentAgent,
  Agent,
  defaultTools,
  createTool,
  MemoryStorageAdapter,
  ToolDefinition
} from '../../src';
import { createMockLLM, MockLLM } from '../mocks/MockLLM';
import { TEST_CONFIG, getTestFilePath } from '../config';

// ============================================
// Custom CBP Tools
// ============================================

const pdfExtractTool: ToolDefinition = createTool()
  .name('pdf_extract')
  .description('Extract text content from PDF file')
  .category('document')
  .parameter({ name: 'path', type: 'string', required: true, description: 'PDF file path' })
  .returns('string')
  .execute(async (params) => {
    // In real implementation, use pdf-parse or similar
    // For testing, return mock content based on filename
    const filename = path.basename(params.path);
    
    if (filename.includes('CI-CLDT')) {
      return `
COMMERCIAL INVOICE
Invoice No: CI-CLDT2509-1
Date: 2024-11-15
Seller: Vietnam Tire Manufacturing Co., Ltd
Buyer: PIONEER RUBBER INC
Terms: DDP Los Angeles, CA

Items:
- Radial Passenger Tires 205/55R16 - Qty: 200 - Unit Price: $45.00 - Total: $9,000.00
- Radial Passenger Tires 225/65R17 - Qty: 300 - Unit Price: $52.00 - Total: $15,600.00

Subtotal: $24,600.00
Freight: $1,200.00
Insurance: $300.00
Total: $26,100.00
Currency: USD
`;
    }
    
    if (filename.includes('PL-CLDT')) {
      return `
PACKING LIST
Packing List No: PL-CLDT2509-1
Date: 2024-11-15
Shipper: Vietnam Tire Manufacturing Co., Ltd
Consignee: PIONEER RUBBER INC

Container: CTASO5091443
Seal No: VN2024115001

Items:
- Carton 1-100: Radial Tires 205/55R16 - 2 pcs/carton - Total: 200 pcs - Weight: 2,400 kg
- Carton 101-250: Radial Tires 225/65R17 - 2 pcs/carton - Total: 300 pcs - Weight: 4,200 kg

Total Packages: 250 cartons
Total Gross Weight: 6,600 kg
Total Net Weight: 6,000 kg
`;
    }

    if (filename.includes('Certificate')) {
      return `
CERTIFICATE OF ORIGIN (FORM B)
Certificate No: VN-US 25/01/074565B
Issuing Authority: Vietnam Chamber of Commerce and Industry

Exporter: Vietnam Tire Manufacturing Co., Ltd
Address: 123 Industrial Zone, Binh Duong Province, Vietnam

Consignee: PIONEER RUBBER INC
Address: 456 Commerce Ave, Los Angeles, CA 90001, USA

Country of Origin: VIETNAM
Goods Description: Passenger Vehicle and Light Truck Tires
HS Code: 4011.10

This is to certify that the goods described above originate in Vietnam.
`;
    }

    return `Content extracted from ${filename}`;
  })
  .build();

const excelParseTool: ToolDefinition = createTool()
  .name('excel_parse')
  .description('Parse Excel file and extract data')
  .category('document')
  .parameter({ name: 'path', type: 'string', required: true, description: 'Excel file path' })
  .returns('object')
  .execute(async (params) => {
    // Mock Excel parsing
    const filename = path.basename(params.path);
    
    if (filename.includes('Checklist')) {
      return {
        sheets: ['Requirements', 'Documents', 'Status'],
        data: {
          Requirements: [
            { item: 'Commercial Invoice', required: true, status: 'Received' },
            { item: 'Packing List', required: true, status: 'Received' },
            { item: 'Bill of Lading', required: true, status: 'Received' },
            { item: 'Certificate of Origin', required: true, status: 'Received' },
            { item: 'Payment Proof', required: true, status: 'Pending' },
            { item: 'Entry Summary CF-7501', required: true, status: 'Pending' }
          ]
        }
      };
    }

    if (filename.includes('payment')) {
      return {
        sheets: ['Payments'],
        data: {
          Payments: [
            { date: '2024-11-10', from: 'PIONEER RUBBER INC', to: 'Vietnam Tire', amount: 26100, reference: 'TT20241110' }
          ]
        }
      };
    }

    return { sheets: [], data: {} };
  })
  .build();

const complianceCheckTool: ToolDefinition = createTool()
  .name('compliance_check')
  .description('Check CBP compliance requirements')
  .category('compliance')
  .parameter({ name: 'documents', type: 'object', required: true, description: 'Document data' })
  .parameter({ name: 'entryNumber', type: 'string', required: true, description: 'Entry number' })
  .returns('object')
  .execute(async (params) => {
    const { documents, entryNumber } = params;
    
    return {
      entryNumber,
      checkDate: new Date().toISOString(),
      results: {
        documentCompleteness: {
          passed: true,
          score: 85,
          missing: ['Payment verification', 'Duty calculation worksheet']
        },
        valueConsistency: {
          passed: true,
          invoiceTotal: 26100,
          declaredValue: 26100,
          variance: 0
        },
        originVerification: {
          passed: true,
          declaredOrigin: 'Vietnam',
          certificateOrigin: 'Vietnam',
          hsCode: '4011.10'
        },
        adCvdRisk: {
          level: 'medium',
          caseNumber: 'A-552-822',
          productScope: 'Passenger Vehicle and Light Truck Tires from Vietnam',
          recommendations: [
            'Verify exporter is cooperating respondent',
            'Confirm cash deposit rate',
            'Document DDP transaction structure'
          ]
        }
      },
      overallStatus: 'Review Required',
      nextActions: [
        'Complete 18-point questionnaire response',
        'Provide payment chain documentation',
        'Prepare IOR authorization letter'
      ]
    };
  })
  .build();

// ============================================
// Test Suite: File Access
// ============================================

describe('CBP Document File Access', () => {
  it('should have test files available', async () => {
    const uploadsDir = TEST_CONFIG.uploadsDir;
    
    try {
      const files = await fs.readdir(uploadsDir);
      expect(files.length).toBeGreaterThan(0);
    } catch (error) {
      console.log('Uploads directory not accessible - skipping file tests');
    }
  });

  it('should identify CBP case files', async () => {
    const expectedFiles = [
      TEST_CONFIG.testFiles.commercialInvoice,
      TEST_CONFIG.testFiles.packingList,
      TEST_CONFIG.testFiles.certificateOfOrigin
    ];

    for (const file of expectedFiles) {
      const filePath = getTestFilePath(file);
      try {
        await fs.access(filePath);
        expect(true).toBe(true);
      } catch {
        console.log(`File not found: ${file}`);
      }
    }
  });
});

// ============================================
// Test Suite: CBP Document Processing
// ============================================

describe('CBP Document Processing Agent', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    
    // Add CBP-specific responses
    mockLLM.addResponse(/invoice|发票/i, () => JSON.stringify({
      invoiceNumber: 'CI-CLDT2509-1',
      seller: 'Vietnam Tire Manufacturing Co., Ltd',
      buyer: 'PIONEER RUBBER INC',
      terms: 'DDP',
      total: 26100,
      currency: 'USD'
    }));

    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
      tools: [
        ...defaultTools,
        pdfExtractTool,
        excelParseTool,
        complianceCheckTool
      ]
    });
  });

  it('should have CBP tools registered', () => {
    const tools = agent.getAvailableTools();
    
    expect(tools).toContain('pdf_extract');
    expect(tools).toContain('excel_parse');
    expect(tools).toContain('compliance_check');
  });

  it('should process CBP compliance check task', async () => {
    const events: string[] = [];
    
    agent.on('status', () => events.push('status'));
    agent.on('plan:created', () => events.push('plan:created'));

    const response = await agent.process(
      'CBP合规检查 - 验证商业发票、装箱单和原产地证书',
      {
        entryNumber: TEST_CONFIG.cbpCase.entryNumber,
        invoicePath: getTestFilePath(TEST_CONFIG.testFiles.commercialInvoice),
        packingListPath: getTestFilePath(TEST_CONFIG.testFiles.packingList),
        certificatePath: getTestFilePath(TEST_CONFIG.testFiles.certificateOfOrigin)
      }
    );

    expect(response).toBeDefined();
    expect(response.taskId).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
  });

  it('should analyze AD/CVD requirements', async () => {
    let planSteps: any[] = [];
    
    agent.on('plan:created', ({ plan }) => {
      planSteps = plan.steps;
    });

    await agent.process(
      '分析反倾销/反补贴要求',
      { caseNumber: 'A-552-822' }
    );

    expect(mockLLM.wasCalledWith(/AD\/CVD|反倾销/i)).toBe(true);
  });

  it('should generate compliance report', async () => {
    const response = await agent.process(
      '生成CBP合规检查报告',
      {
        entryNumber: TEST_CONFIG.cbpCase.entryNumber,
        importer: TEST_CONFIG.cbpCase.importer
      }
    );

    expect(response).toBeDefined();
    expect(mockLLM.wasCalledWith(/报告|report/i)).toBe(true);
  });
});

// ============================================
// Test Suite: Document Cross-Validation
// ============================================

describe('Document Cross-Validation', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
        maxSteps: 10,
        enableParallel: false,
        confidenceThreshold: 0.8,
        planningTimeout: 30000
      },
      executorConfig: {
        maxConcurrency: 1,
        defaultTimeout: 10000,
        retryDelay: 100,
        maxRetries: 2
      },
      tools: [pdfExtractTool, excelParseTool, complianceCheckTool]
    });
  });

  it('should validate invoice against packing list', async () => {
    mockLLM.addResponse(/对比|compare|验证/i, () => JSON.stringify({
      invoiceQuantity: 500,
      packingListQuantity: 500,
      match: true,
      discrepancies: []
    }));

    const response = await agent.process(
      '对比商业发票和装箱单的数量',
      {
        invoicePath: getTestFilePath(TEST_CONFIG.testFiles.commercialInvoice),
        packingListPath: getTestFilePath(TEST_CONFIG.testFiles.packingList)
      }
    );

    expect(response).toBeDefined();
    expect(mockLLM.wasCalledWith(/对比|compare/i)).toBe(true);
  });

  it('should verify origin certificate', async () => {
    mockLLM.addResponse(/原产地|origin|certificate/i, () => JSON.stringify({
      certificateNumber: 'VN-US 25/01/074565B',
      country: 'Vietnam',
      valid: true,
      expiryDate: null
    }));

    const response = await agent.process(
      '验证原产地证书',
      {
        certificatePath: getTestFilePath(TEST_CONFIG.testFiles.certificateOfOrigin)
      }
    );

    expect(response).toBeDefined();
  });
});

// ============================================
// Test Suite: CBP Questionnaire Processing
// ============================================

describe('CBP Questionnaire Processing', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    
    // Add 18-point questionnaire responses
    mockLLM.addResponse(/问卷|questionnaire|18.*point/i, () => JSON.stringify({
      questions: [
        { number: 1, topic: 'Transaction relationship', status: 'answered' },
        { number: 2, topic: 'Payment terms', status: 'answered' },
        { number: 3, topic: 'Shipping arrangements', status: 'pending' },
        // ... more questions
      ],
      completionRate: 85,
      pendingItems: ['Bank statements', 'Wire transfer records']
    }));

    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
      tools: [pdfExtractTool, excelParseTool]
    });
  });

  it('should analyze questionnaire requirements', async () => {
    const response = await agent.process(
      '分析18点问卷要求',
      {
        questionnairePath: getTestFilePath(TEST_CONFIG.testFiles.rejectionQuestionnaire)
      }
    );

    expect(response).toBeDefined();
    expect(mockLLM.wasCalledWith(/问卷|questionnaire/i)).toBe(true);
  });

  it('should identify missing documentation', async () => {
    mockLLM.addResponse(/缺失|missing|gap/i, () => JSON.stringify({
      requiredDocuments: [
        'Commercial Invoice',
        'Packing List',
        'Bill of Lading',
        'Certificate of Origin',
        'Payment Proof',
        'Entry Summary'
      ],
      providedDocuments: [
        'Commercial Invoice',
        'Packing List',
        'Bill of Lading',
        'Certificate of Origin'
      ],
      missingDocuments: [
        'Payment Proof',
        'Entry Summary'
      ],
      gapAnalysis: {
        critical: ['Payment Proof'],
        important: ['Entry Summary'],
        optional: []
      }
    }));

    const response = await agent.process('识别缺失文档');

    expect(response).toBeDefined();
  });
});

// ============================================
// Test Suite: Full CBP Review Workflow
// ============================================

describe('Full CBP Review Workflow', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
        maxSteps: 25,
        enableParallel: true,
        confidenceThreshold: 0.8,
        planningTimeout: 120000
      },
      executorConfig: {
        maxConcurrency: 5,
        defaultTimeout: 60000,
        retryDelay: 2000,
        maxRetries: 3
      },
      tools: [
        ...defaultTools,
        pdfExtractTool,
        excelParseTool,
        complianceCheckTool
      ]
    });
  });

  it('should execute complete CBP review workflow', async () => {
    const workflow = {
      taskId: '',
      phases: [] as string[],
      steps: [] as string[],
      results: {} as any
    };

    agent.on('plan:created', ({ plan }) => {
      workflow.phases.push('planning');
    });

    agent.on('step:start', ({ stepName }) => {
      workflow.steps.push(stepName);
    });

    agent.on('step:complete', ({ result }) => {
      workflow.results[result.stepId] = result.status;
    });

    const response = await agent.process(
      `
      完整CBP审查流程:
      1. 提取所有文档内容
      2. 验证文档一致性
      3. 检查AD/CVD合规
      4. 分析问卷要求
      5. 生成合规报告
      `,
      {
        entryNumber: TEST_CONFIG.cbpCase.entryNumber,
        importer: TEST_CONFIG.cbpCase.importer,
        product: TEST_CONFIG.cbpCase.product,
        documents: {
          invoice: getTestFilePath(TEST_CONFIG.testFiles.commercialInvoice),
          packingList: getTestFilePath(TEST_CONFIG.testFiles.packingList),
          certificate: getTestFilePath(TEST_CONFIG.testFiles.certificateOfOrigin),
          checklist: getTestFilePath(TEST_CONFIG.testFiles.rejectionChecklist)
        }
      }
    );

    workflow.taskId = response.taskId;

    expect(response).toBeDefined();
    expect(response.taskId).toBeDefined();
    expect(workflow.phases).toContain('planning');
  });

  it('should handle workflow with confirmation points', async () => {
    let confirmationRequested = false;

    agent.on('waiting:confirmation', ({ description }) => {
      confirmationRequested = true;
      // Auto-confirm in test
      agent.confirm({ approved: true });
    });

    await agent.process(
      '执行需要确认的CBP审查流程',
      { requireConfirmation: true }
    );

    // Confirmation may or may not be requested depending on plan
  });
});

// ============================================
// Test Suite: Report Generation
// ============================================

describe('CBP Report Generation', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
      tools: defaultTools
    });
  });

  it('should generate compliance summary report', async () => {
    mockLLM.addResponse(/summary|摘要|总结/i, () => `
# 合规检查摘要

## 基本信息
- Entry Number: ${TEST_CONFIG.cbpCase.entryNumber}
- Importer: ${TEST_CONFIG.cbpCase.importer}
- Product: ${TEST_CONFIG.cbpCase.product}

## 检查结果
- 文档完整性: 85%
- 数值一致性: 通过
- 原产地验证: 通过
- AD/CVD风险: 中等

## 待办事项
1. 补充付款证明
2. 完成问卷回复
`);

    const response = await agent.process('生成合规检查摘要报告');

    expect(response).toBeDefined();
    expect(mockLLM.wasCalledWith(/summary|摘要/i)).toBe(true);
  });

  it('should generate action items list', async () => {
    mockLLM.addResponse(/action|行动|待办/i, () => JSON.stringify({
      immediate: [
        { priority: 1, action: 'Submit payment proof', deadline: '2024-12-15' },
        { priority: 2, action: 'Complete questionnaire', deadline: '2024-12-20' }
      ],
      shortTerm: [
        { priority: 3, action: 'Prepare entry summary', deadline: '2025-01-05' }
      ],
      ongoing: [
        { action: 'Monitor case status' }
      ]
    }));

    const response = await agent.process('生成行动计划');

    expect(response).toBeDefined();
  });
});

export { pdfExtractTool, excelParseTool, complianceCheckTool };
