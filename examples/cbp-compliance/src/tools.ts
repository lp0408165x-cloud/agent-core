// ============================================
// CBP Compliance - Custom Tools
// ============================================

import { createTool, ToolDefinition } from '../../src';
import {
  CommercialInvoice,
  PackingList,
  BillOfLading,
  CertificateOfOrigin,
  ADCVDCase,
  ComplianceCheckResult,
  DocumentValidation,
  CrossReference,
  ComplianceReport
} from './types';

// -------------------- Document Extraction Tools --------------------

/**
 * Extract commercial invoice data from PDF
 */
export const extractInvoiceTool = createTool()
  .name('extract_invoice')
  .description('Extract structured data from commercial invoice PDF')
  .category('document')
  .parameter({
    name: 'filePath',
    type: 'string',
    required: true,
    description: 'Path to the commercial invoice PDF file'
  })
  .returns('object')
  .execute(async (params): Promise<CommercialInvoice> => {
    // In production, this would use pdf-parse and LLM extraction
    // For demo, return mock data based on file path
    console.log(`[Tool] Extracting invoice from: ${params.filePath}`);
    
    return {
      invoiceNumber: 'CI-2024-001234',
      invoiceDate: '2024-12-15',
      seller: {
        name: 'Vietnam Tire Manufacturing Co., Ltd',
        address: '123 Industrial Zone, Ho Chi Minh City',
        country: 'Vietnam'
      },
      buyer: {
        name: 'PIONEER RUBBER INC',
        address: '456 Commerce Blvd, Los Angeles, CA 90001',
        country: 'United States'
      },
      items: [
        {
          description: 'Passenger Vehicle Tires 205/55R16',
          hsCode: '4011.10.10',
          quantity: 500,
          unit: 'PCS',
          unitPrice: 45.00,
          totalPrice: 22500.00,
          countryOfOrigin: 'Vietnam'
        },
        {
          description: 'Passenger Vehicle Tires 225/65R17',
          hsCode: '4011.10.10',
          quantity: 80,
          unit: 'PCS',
          unitPrice: 52.00,
          totalPrice: 4160.00,
          countryOfOrigin: 'Vietnam'
        }
      ],
      currency: 'USD',
      subtotal: 26660.00,
      freight: 1200.00,
      insurance: 240.00,
      total: 28100.00,
      paymentTerms: 'T/T 30 Days',
      incoterms: 'DDP Los Angeles'
    };
  })
  .build();

/**
 * Extract packing list data from PDF
 */
export const extractPackingListTool = createTool()
  .name('extract_packing_list')
  .description('Extract structured data from packing list PDF')
  .category('document')
  .parameter({
    name: 'filePath',
    type: 'string',
    required: true,
    description: 'Path to the packing list PDF file'
  })
  .returns('object')
  .execute(async (params): Promise<PackingList> => {
    console.log(`[Tool] Extracting packing list from: ${params.filePath}`);
    
    return {
      packingListNumber: 'PL-2024-001234',
      invoiceReference: 'CI-2024-001234',
      packages: [
        {
          packageNumber: 'PKG-001',
          description: 'Passenger Vehicle Tires 205/55R16',
          quantity: 500,
          grossWeight: 4500,
          netWeight: 4250
        },
        {
          packageNumber: 'PKG-002',
          description: 'Passenger Vehicle Tires 225/65R17',
          quantity: 80,
          grossWeight: 880,
          netWeight: 800
        }
      ],
      totalPackages: 2,
      totalGrossWeight: 5380,
      totalNetWeight: 5050,
      weightUnit: 'KG',
      totalVolume: 45.5,
      volumeUnit: 'CBM'
    };
  })
  .build();

/**
 * Extract bill of lading data
 */
export const extractBLTool = createTool()
  .name('extract_bill_of_lading')
  .description('Extract structured data from bill of lading')
  .category('document')
  .parameter({
    name: 'filePath',
    type: 'string',
    required: true,
    description: 'Path to the bill of lading PDF file'
  })
  .returns('object')
  .execute(async (params): Promise<BillOfLading> => {
    console.log(`[Tool] Extracting B/L from: ${params.filePath}`);
    
    return {
      blNumber: 'HLCU1234567890',
      bookingNumber: 'BK-2024-56789',
      shipper: {
        name: 'Vietnam Tire Manufacturing Co., Ltd',
        address: '123 Industrial Zone, Ho Chi Minh City, Vietnam'
      },
      consignee: {
        name: 'PIONEER RUBBER INC',
        address: '456 Commerce Blvd, Los Angeles, CA 90001, USA'
      },
      notifyParty: {
        name: 'ABC Customs Broker',
        address: '789 Port Ave, Long Beach, CA 90802'
      },
      vessel: 'EVER GIVEN',
      voyage: 'V.025E',
      portOfLoading: 'Ho Chi Minh City, Vietnam',
      portOfDischarge: 'Long Beach, CA, USA',
      placeOfDelivery: 'Los Angeles, CA',
      containerNumbers: ['HLCU7654321'],
      sealNumbers: ['SL98765432'],
      description: 'Passenger Vehicle Tires - 580 PCS',
      grossWeight: 5380,
      measurement: 45.5,
      freightTerms: 'PREPAID',
      dateOfIssue: '2024-12-16'
    };
  })
  .build();

/**
 * Extract certificate of origin data
 */
export const extractCOTool = createTool()
  .name('extract_certificate_of_origin')
  .description('Extract structured data from certificate of origin')
  .category('document')
  .parameter({
    name: 'filePath',
    type: 'string',
    required: true,
    description: 'Path to the certificate of origin PDF file'
  })
  .returns('object')
  .execute(async (params): Promise<CertificateOfOrigin> => {
    console.log(`[Tool] Extracting C/O from: ${params.filePath}`);
    
    return {
      certificateNumber: 'VN-US-2024-074565',
      exporterName: 'Vietnam Tire Manufacturing Co., Ltd',
      exporterAddress: '123 Industrial Zone, Ho Chi Minh City, Vietnam',
      producerName: 'Vietnam Tire Manufacturing Co., Ltd',
      producerAddress: '123 Industrial Zone, Ho Chi Minh City, Vietnam',
      importerName: 'PIONEER RUBBER INC',
      importerAddress: '456 Commerce Blvd, Los Angeles, CA 90001, USA',
      countryOfOrigin: 'Vietnam',
      items: [
        {
          description: 'Passenger Vehicle Tires',
          hsCode: '4011.10.10',
          originCriterion: 'WO - Wholly Obtained'
        }
      ],
      dateOfIssue: '2024-12-15',
      issuingAuthority: 'Vietnam Chamber of Commerce and Industry'
    };
  })
  .build();

// -------------------- Validation Tools --------------------

/**
 * Cross-validate documents for consistency
 */
export const crossValidateTool = createTool()
  .name('cross_validate_documents')
  .description('Cross-validate multiple documents for consistency')
  .category('validation')
  .parameter({
    name: 'invoice',
    type: 'object',
    required: true,
    description: 'Commercial invoice data'
  })
  .parameter({
    name: 'packingList',
    type: 'object',
    required: true,
    description: 'Packing list data'
  })
  .parameter({
    name: 'billOfLading',
    type: 'object',
    required: false,
    description: 'Bill of lading data'
  })
  .returns('object')
  .execute(async (params): Promise<DocumentValidation> => {
    console.log(`[Tool] Cross-validating documents...`);
    
    const crossRefs: CrossReference[] = [];
    const errors: any[] = [];
    const warnings: any[] = [];
    
    const invoice = params.invoice as CommercialInvoice;
    const packingList = params.packingList as PackingList;
    
    // Check invoice reference
    const invoiceRefMatch = packingList.invoiceReference === invoice.invoiceNumber;
    crossRefs.push({
      sourceDocument: 'Packing List',
      targetDocument: 'Commercial Invoice',
      field: 'Invoice Reference',
      matches: invoiceRefMatch,
      sourceValue: packingList.invoiceReference,
      targetValue: invoice.invoiceNumber
    });
    
    if (!invoiceRefMatch) {
      errors.push({
        field: 'Invoice Reference',
        message: 'Invoice number does not match between documents',
        expectedValue: invoice.invoiceNumber,
        actualValue: packingList.invoiceReference
      });
    }
    
    // Check quantity
    const invoiceQty = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
    const packingQty = packingList.packages.reduce((sum, pkg) => sum + pkg.quantity, 0);
    const qtyMatch = invoiceQty === packingQty;
    
    crossRefs.push({
      sourceDocument: 'Commercial Invoice',
      targetDocument: 'Packing List',
      field: 'Total Quantity',
      matches: qtyMatch,
      sourceValue: String(invoiceQty),
      targetValue: String(packingQty)
    });
    
    if (!qtyMatch) {
      warnings.push({
        field: 'Total Quantity',
        message: 'Quantity mismatch between invoice and packing list',
        suggestion: 'Verify quantities with supplier'
      });
    }
    
    // Check B/L if provided
    if (params.billOfLading) {
      const bl = params.billOfLading as BillOfLading;
      const weightMatch = Math.abs(bl.grossWeight - packingList.totalGrossWeight) < 10;
      
      crossRefs.push({
        sourceDocument: 'Bill of Lading',
        targetDocument: 'Packing List',
        field: 'Gross Weight',
        matches: weightMatch,
        sourceValue: String(bl.grossWeight),
        targetValue: String(packingList.totalGrossWeight)
      });
      
      if (!weightMatch) {
        warnings.push({
          field: 'Gross Weight',
          message: 'Weight discrepancy between B/L and packing list',
          suggestion: 'Minor discrepancies may be acceptable'
        });
      }
    }
    
    return {
      documentType: 'Cross-Validation',
      isValid: errors.length === 0,
      errors,
      warnings,
      crossReferences: crossRefs
    };
  })
  .build();

// -------------------- AD/CVD Tools --------------------

/**
 * Check AD/CVD case applicability
 */
export const checkADCVDTool = createTool()
  .name('check_adcvd_case')
  .description('Check if merchandise is subject to AD/CVD duties')
  .category('compliance')
  .parameter({
    name: 'hsCode',
    type: 'string',
    required: true,
    description: 'HS tariff code'
  })
  .parameter({
    name: 'countryOfOrigin',
    type: 'string',
    required: true,
    description: 'Country of origin'
  })
  .parameter({
    name: 'productDescription',
    type: 'string',
    required: true,
    description: 'Product description'
  })
  .returns('object')
  .execute(async (params): Promise<{ applicable: boolean; cases: ADCVDCase[] }> => {
    console.log(`[Tool] Checking AD/CVD for HS ${params.hsCode} from ${params.countryOfOrigin}`);
    
    // Check for Vietnam tires case
    if (
      params.hsCode.startsWith('4011') &&
      params.countryOfOrigin.toLowerCase().includes('vietnam')
    ) {
      return {
        applicable: true,
        cases: [
          {
            caseNumber: 'A-552-830',
            caseType: 'AD',
            countryOfOrigin: 'Vietnam',
            product: 'Passenger Vehicle and Light Truck Tires',
            adRate: 22.27,
            bondRequired: true,
            reviewPeriod: '2023-2024'
          },
          {
            caseNumber: 'C-552-831',
            caseType: 'CVD',
            countryOfOrigin: 'Vietnam',
            product: 'Passenger Vehicle and Light Truck Tires',
            cvdRate: 6.23,
            bondRequired: true,
            reviewPeriod: '2023-2024'
          }
        ]
      };
    }
    
    return {
      applicable: false,
      cases: []
    };
  })
  .build();

/**
 * Calculate total duties and fees
 */
export const calculateDutiesTool = createTool()
  .name('calculate_duties')
  .description('Calculate total duties, AD/CVD, and fees')
  .category('compliance')
  .parameter({
    name: 'enteredValue',
    type: 'number',
    required: true,
    description: 'Total entered value in USD'
  })
  .parameter({
    name: 'hsCode',
    type: 'string',
    required: true,
    description: 'HS tariff code'
  })
  .parameter({
    name: 'adcvdCases',
    type: 'array',
    required: false,
    description: 'Applicable AD/CVD cases'
  })
  .returns('object')
  .execute(async (params) => {
    console.log(`[Tool] Calculating duties for value $${params.enteredValue}`);
    
    const enteredValue = params.enteredValue as number;
    const regularDutyRate = 4.0; // 4% for tires
    const regularDuty = enteredValue * (regularDutyRate / 100);
    
    let adDuty = 0;
    let cvdDuty = 0;
    
    if (params.adcvdCases && Array.isArray(params.adcvdCases)) {
      for (const caseInfo of params.adcvdCases) {
        if (caseInfo.adRate) {
          adDuty += enteredValue * (caseInfo.adRate / 100);
        }
        if (caseInfo.cvdRate) {
          cvdDuty += enteredValue * (caseInfo.cvdRate / 100);
        }
      }
    }
    
    const mpf = Math.min(Math.max(enteredValue * 0.003464, 31.67), 614.35);
    const hmf = enteredValue * 0.00125;
    
    return {
      enteredValue,
      regularDuty: {
        rate: regularDutyRate,
        amount: Math.round(regularDuty * 100) / 100
      },
      antidumpingDuty: {
        rate: params.adcvdCases?.[0]?.adRate || 0,
        amount: Math.round(adDuty * 100) / 100
      },
      countervailingDuty: {
        rate: params.adcvdCases?.[1]?.cvdRate || 0,
        amount: Math.round(cvdDuty * 100) / 100
      },
      merchandiseProcessingFee: Math.round(mpf * 100) / 100,
      harborMaintenanceFee: Math.round(hmf * 100) / 100,
      totalDuties: Math.round((regularDuty + adDuty + cvdDuty + mpf + hmf) * 100) / 100
    };
  })
  .build();

// -------------------- Compliance Check Tool --------------------

/**
 * Perform comprehensive compliance check
 */
export const complianceCheckTool = createTool()
  .name('compliance_check')
  .description('Perform comprehensive CBP compliance check')
  .category('compliance')
  .parameter({
    name: 'entryNumber',
    type: 'string',
    required: true,
    description: 'CBP entry number'
  })
  .parameter({
    name: 'documents',
    type: 'object',
    required: true,
    description: 'Extracted document data'
  })
  .parameter({
    name: 'validation',
    type: 'object',
    required: true,
    description: 'Document validation results'
  })
  .parameter({
    name: 'adcvdInfo',
    type: 'object',
    required: false,
    description: 'AD/CVD case information'
  })
  .returns('object')
  .execute(async (params): Promise<ComplianceCheckResult> => {
    console.log(`[Tool] Performing compliance check for entry ${params.entryNumber}`);
    
    const checks: any[] = [];
    const issues: any[] = [];
    const recommendations: string[] = [];
    const requiredActions: any[] = [];
    
    // Check 1: Document Completeness
    const docs = params.documents as any;
    const hasInvoice = !!docs.invoice;
    const hasPackingList = !!docs.packingList;
    const hasBL = !!docs.billOfLading;
    const hasCO = !!docs.certificateOfOrigin;
    
    const docScore = [hasInvoice, hasPackingList, hasBL, hasCO]
      .filter(Boolean).length / 4 * 100;
    
    checks.push({
      category: 'Documentation',
      name: 'Document Completeness',
      status: docScore >= 75 ? 'pass' : docScore >= 50 ? 'warning' : 'fail',
      score: docScore,
      details: `${Math.round(docScore)}% of required documents present`
    });
    
    if (!hasInvoice) {
      issues.push({
        severity: 'critical',
        category: 'Documentation',
        title: 'Missing Commercial Invoice',
        description: 'Commercial invoice is required for CBP entry',
        regulation: '19 CFR 141.86',
        potentialPenalty: 'Entry rejection or delay',
        suggestedResolution: 'Obtain commercial invoice from seller immediately'
      });
      
      requiredActions.push({
        priority: 'immediate',
        action: 'Obtain commercial invoice from seller',
        deadline: 'Before entry submission',
        documentRequired: ['Commercial Invoice']
      });
    }
    
    // Check 2: Document Consistency
    const validation = params.validation as DocumentValidation;
    const consistencyScore = validation.isValid ? 100 : 
      validation.errors.length === 0 ? 80 : 50;
    
    checks.push({
      category: 'Validation',
      name: 'Document Consistency',
      status: validation.isValid ? 'pass' : 'warning',
      score: consistencyScore,
      details: `${validation.crossReferences.filter(r => r.matches).length}/${validation.crossReferences.length} cross-references match`
    });
    
    if (!validation.isValid) {
      recommendations.push('Review and reconcile document discrepancies');
    }
    
    // Check 3: AD/CVD Compliance
    const adcvd = params.adcvdInfo as any;
    if (adcvd?.applicable) {
      checks.push({
        category: 'AD/CVD',
        name: 'AD/CVD Declaration',
        status: 'warning',
        score: 70,
        details: `Subject to ${adcvd.cases.length} AD/CVD case(s)`
      });
      
      issues.push({
        severity: 'high',
        category: 'AD/CVD',
        title: 'AD/CVD Duties Applicable',
        description: `Entry is subject to AD/CVD orders: ${adcvd.cases.map((c: any) => c.caseNumber).join(', ')}`,
        regulation: '19 USC 1673, 1671',
        potentialPenalty: 'Additional duties plus interest',
        suggestedResolution: 'Ensure proper AD/CVD declaration and bond coverage'
      });
      
      requiredActions.push({
        priority: 'high',
        action: 'Verify AD/CVD bond coverage',
        documentRequired: ['Continuous Bond', 'AD/CVD Bond Rider']
      });
      
      recommendations.push('Consider requesting new shipper review if applicable');
      recommendations.push('Maintain detailed transaction records for annual review');
    } else {
      checks.push({
        category: 'AD/CVD',
        name: 'AD/CVD Status',
        status: 'pass',
        score: 100,
        details: 'No AD/CVD orders applicable'
      });
    }
    
    // Check 4: Valuation
    if (docs.invoice) {
      const invoice = docs.invoice as CommercialInvoice;
      const valuationIssue = invoice.incoterms.includes('DDP');
      
      checks.push({
        category: 'Valuation',
        name: 'Transaction Valuation',
        status: valuationIssue ? 'warning' : 'pass',
        score: valuationIssue ? 75 : 100,
        details: `Incoterms: ${invoice.incoterms}`
      });
      
      if (valuationIssue) {
        issues.push({
          severity: 'medium',
          category: 'Valuation',
          title: 'DDP Transaction Structure',
          description: 'DDP terms may raise questions about transaction value and IOR status',
          regulation: '19 CFR 152.103',
          suggestedResolution: 'Document the transaction structure and IOR arrangement clearly'
        });
        
        recommendations.push('Prepare documentation showing legitimate IOR arrangement');
        recommendations.push('Consider converting to CIF/FOB terms for future shipments');
      }
    }
    
    // Check 5: Country of Origin
    if (docs.certificateOfOrigin) {
      checks.push({
        category: 'Origin',
        name: 'Country of Origin Documentation',
        status: 'pass',
        score: 100,
        details: 'Certificate of Origin present and valid'
      });
    } else {
      checks.push({
        category: 'Origin',
        name: 'Country of Origin Documentation',
        status: 'warning',
        score: 60,
        details: 'Certificate of Origin not provided'
      });
      
      recommendations.push('Obtain Certificate of Origin from exporter');
    }
    
    // Calculate overall score
    const overallScore = Math.round(
      checks.reduce((sum, c) => sum + c.score, 0) / checks.length
    );
    
    // Determine risk level
    const riskLevel: any = overallScore >= 90 ? 'low' :
      overallScore >= 70 ? 'medium' :
      overallScore >= 50 ? 'high' : 'critical';
    
    return {
      entryNumber: params.entryNumber,
      checkDate: new Date().toISOString(),
      overallScore,
      riskLevel,
      status: overallScore >= 70 ? 'pass' : overallScore >= 50 ? 'warning' : 'fail',
      checks,
      issues,
      recommendations,
      requiredActions
    };
  })
  .build();

// -------------------- Report Generation Tool --------------------

/**
 * Generate compliance report
 */
export const generateReportTool = createTool()
  .name('generate_report')
  .description('Generate comprehensive compliance report')
  .category('report')
  .parameter({
    name: 'entryNumber',
    type: 'string',
    required: true,
    description: 'Entry number'
  })
  .parameter({
    name: 'complianceResult',
    type: 'object',
    required: true,
    description: 'Compliance check result'
  })
  .parameter({
    name: 'documents',
    type: 'object',
    required: true,
    description: 'Document data'
  })
  .parameter({
    name: 'dutyCalculation',
    type: 'object',
    required: false,
    description: 'Duty calculation'
  })
  .returns('string')
  .execute(async (params): Promise<string> => {
    console.log(`[Tool] Generating report for entry ${params.entryNumber}`);
    
    const result = params.complianceResult as ComplianceCheckResult;
    const docs = params.documents as any;
    const duties = params.dutyCalculation as any;
    
    const report = `
# CBP Compliance Report

## Entry Information
- **Entry Number:** ${params.entryNumber}
- **Generated:** ${new Date().toLocaleString()}
- **Importer:** ${docs.invoice?.buyer?.name || 'N/A'}
- **Exporter:** ${docs.invoice?.seller?.name || 'N/A'}
- **Origin:** ${docs.invoice?.seller?.country || 'N/A'}

---

## Executive Summary

**Overall Compliance Score: ${result.overallScore}/100**

**Risk Level: ${result.riskLevel.toUpperCase()}**

**Status: ${result.status.toUpperCase()}**

${result.issues.length > 0 ? `
⚠️ **${result.issues.length} issue(s) identified requiring attention**
` : '✅ No critical issues identified'}

---

## Compliance Checks

${result.checks.map(check => `
### ${check.category}: ${check.name}
- **Status:** ${check.status === 'pass' ? '✅ Pass' : check.status === 'warning' ? '⚠️ Warning' : '❌ Fail'}
- **Score:** ${check.score}/100
- **Details:** ${check.details}
`).join('\n')}

---

## Issues Identified

${result.issues.length === 0 ? 'No issues identified.' : result.issues.map((issue, i) => `
### ${i + 1}. ${issue.title}
- **Severity:** ${issue.severity.toUpperCase()}
- **Category:** ${issue.category}
- **Description:** ${issue.description}
${issue.regulation ? `- **Regulation:** ${issue.regulation}` : ''}
${issue.potentialPenalty ? `- **Potential Penalty:** ${issue.potentialPenalty}` : ''}
- **Suggested Resolution:** ${issue.suggestedResolution}
`).join('\n')}

---

## Required Actions

${result.requiredActions.length === 0 ? 'No immediate actions required.' : result.requiredActions.map((action, i) => `
${i + 1}. **[${action.priority.toUpperCase()}]** ${action.action}
   ${action.deadline ? `- Deadline: ${action.deadline}` : ''}
   ${action.documentRequired ? `- Documents: ${action.documentRequired.join(', ')}` : ''}
`).join('\n')}

---

## Recommendations

${result.recommendations.length === 0 ? 'No additional recommendations.' : result.recommendations.map((rec, i) => `
${i + 1}. ${rec}
`).join('\n')}

${duties ? `
---

## Duty Calculation

| Component | Rate | Amount |
|-----------|------|--------|
| Entered Value | - | $${duties.enteredValue.toLocaleString()} |
| Regular Duty | ${duties.regularDuty.rate}% | $${duties.regularDuty.amount.toLocaleString()} |
| Antidumping Duty | ${duties.antidumpingDuty.rate}% | $${duties.antidumpingDuty.amount.toLocaleString()} |
| Countervailing Duty | ${duties.countervailingDuty.rate}% | $${duties.countervailingDuty.amount.toLocaleString()} |
| MPF | 0.3464% | $${duties.merchandiseProcessingFee.toLocaleString()} |
| HMF | 0.125% | $${duties.harborMaintenanceFee.toLocaleString()} |
| **Total** | - | **$${duties.totalDuties.toLocaleString()}** |
` : ''}

---

*Report generated by CBP Compliance Agent*
*This report is for informational purposes and does not constitute legal advice*
`;

    return report;
  })
  .build();

// -------------------- Export All Tools --------------------

export const cbpTools: ToolDefinition[] = [
  extractInvoiceTool,
  extractPackingListTool,
  extractBLTool,
  extractCOTool,
  crossValidateTool,
  checkADCVDTool,
  calculateDutiesTool,
  complianceCheckTool,
  generateReportTool
];

export default cbpTools;
