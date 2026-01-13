// ============================================
// CBP Compliance - Type Definitions
// ============================================

// -------------------- Document Types --------------------

export interface CommercialInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  seller: {
    name: string;
    address: string;
    country: string;
  };
  buyer: {
    name: string;
    address: string;
    country: string;
  };
  shipTo?: {
    name: string;
    address: string;
  };
  items: InvoiceItem[];
  currency: string;
  subtotal: number;
  freight?: number;
  insurance?: number;
  total: number;
  paymentTerms: string;
  incoterms: string;
}

export interface InvoiceItem {
  description: string;
  hsCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  countryOfOrigin: string;
}

export interface PackingList {
  packingListNumber: string;
  invoiceReference: string;
  packages: Package[];
  totalPackages: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  weightUnit: string;
  totalVolume?: number;
  volumeUnit?: string;
}

export interface Package {
  packageNumber: string;
  description: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
}

export interface BillOfLading {
  blNumber: string;
  bookingNumber?: string;
  shipper: {
    name: string;
    address: string;
  };
  consignee: {
    name: string;
    address: string;
  };
  notifyParty?: {
    name: string;
    address: string;
  };
  vessel: string;
  voyage: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery?: string;
  containerNumbers: string[];
  sealNumbers: string[];
  description: string;
  grossWeight: number;
  measurement?: number;
  freightTerms: string;
  dateOfIssue: string;
}

export interface CertificateOfOrigin {
  certificateNumber: string;
  exporterName: string;
  exporterAddress: string;
  producerName?: string;
  producerAddress?: string;
  importerName: string;
  importerAddress: string;
  countryOfOrigin: string;
  items: {
    description: string;
    hsCode: string;
    originCriterion: string;
  }[];
  dateOfIssue: string;
  issuingAuthority: string;
}

// -------------------- Entry Types --------------------

export interface CBPEntry {
  entryNumber: string;
  entryType: string;
  filer: string;
  importer: {
    name: string;
    address: string;
    ein?: string;
    bond?: string;
  };
  portOfEntry: string;
  entryDate: string;
  importDate: string;
  arrivalDate: string;
  merchandise: MerchandiseInfo[];
  totalValue: number;
  totalDuty: number;
  status: EntryStatus;
  flags: string[];
}

export interface MerchandiseInfo {
  lineNumber: number;
  hsCode: string;
  description: string;
  countryOfOrigin: string;
  quantity: number;
  unit: string;
  value: number;
  dutyRate: number;
  dutyAmount: number;
  adcvdCase?: ADCVDCase;
}

export interface ADCVDCase {
  caseNumber: string;
  caseType: 'AD' | 'CVD' | 'AD/CVD';
  countryOfOrigin: string;
  product: string;
  adRate?: number;
  cvdRate?: number;
  bondRequired: boolean;
  reviewPeriod?: string;
}

export type EntryStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'held'
  | 'rejected'
  | 'released'
  | 'liquidated';

// -------------------- Compliance Types --------------------

export interface ComplianceCheckResult {
  entryNumber: string;
  checkDate: string;
  overallScore: number;
  riskLevel: RiskLevel;
  status: ComplianceStatus;
  checks: ComplianceCheck[];
  issues: ComplianceIssue[];
  recommendations: string[];
  requiredActions: RequiredAction[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ComplianceStatus = 'pass' | 'warning' | 'fail';

export interface ComplianceCheck {
  category: string;
  name: string;
  status: ComplianceStatus;
  score: number;
  details: string;
  evidence?: string[];
}

export interface ComplianceIssue {
  severity: RiskLevel;
  category: string;
  title: string;
  description: string;
  regulation?: string;
  potentialPenalty?: string;
  suggestedResolution: string;
}

export interface RequiredAction {
  priority: 'immediate' | 'high' | 'medium' | 'low';
  action: string;
  deadline?: string;
  responsible?: string;
  documentRequired?: string[];
}

// -------------------- Validation Types --------------------

export interface DocumentValidation {
  documentType: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  crossReferences: CrossReference[];
}

export interface ValidationError {
  field: string;
  message: string;
  expectedValue?: string;
  actualValue?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface CrossReference {
  sourceDocument: string;
  targetDocument: string;
  field: string;
  matches: boolean;
  sourceValue: string;
  targetValue: string;
}

// -------------------- Report Types --------------------

export interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  entryInfo: {
    entryNumber: string;
    importer: string;
    product: string;
    origin: string;
    value: number;
  };
  executiveSummary: string;
  complianceResult: ComplianceCheckResult;
  documentAnalysis: {
    documentsReviewed: string[];
    validationResults: DocumentValidation[];
  };
  adcvdAnalysis?: {
    applicable: boolean;
    cases: ADCVDCase[];
    totalLiability: number;
    bondStatus: string;
  };
  timeline: TimelineEvent[];
  appendices: Appendix[];
}

export interface TimelineEvent {
  date: string;
  event: string;
  status: string;
  notes?: string;
}

export interface Appendix {
  title: string;
  type: 'document' | 'table' | 'chart';
  content: any;
}
