// ============================================
// Agent Core - Test Configuration
// ============================================

import { resolve } from 'path';

export const TEST_CONFIG = {
  // Paths
  fixturesDir: resolve(__dirname, 'fixtures'),
  mockDir: resolve(__dirname, 'mocks'),

  // Mock test files (not real documents)
  testFiles: {
    // Mock PDFs
    commercialInvoice: 'mock-invoice.pdf',
    packingList: 'mock-packing-list.pdf',
    certificateOfOrigin: 'mock-certificate.pdf',
    
    // Mock Excel files
    checklist: 'mock-checklist.xlsx',
    
    // Mock Word documents
    report: 'mock-report.docx'
  },

  // Timeouts
  timeouts: {
    short: 5000,
    medium: 30000,
    long: 60000
  },

  // Mock case details for testing
  mockCase: {
    entryNumber: 'TEST-12345678',
    importer: 'TEST COMPANY INC',
    exporter: 'Test Origin',
    product: 'Test Product',
    issue: 'Test Compliance Check'
  },

  // Alias for cbpCase (backward compatibility)
  get cbpCase() {
    return this.mockCase;
  }
};

export function getTestFilePath(fileName: string): string {
  return `${TEST_CONFIG.fixturesDir}/${fileName}`;
}

export function getMockPath(fileName: string): string {
  return `${TEST_CONFIG.mockDir}/${fileName}`;
}
