# CBP Compliance Check Example

A complete example application demonstrating how to use Agent Core for CBP (Customs and Border Protection) compliance checking.

## Features

- 📄 **Document Extraction** - Parse invoices, packing lists, B/L, certificates
- ✅ **Cross-Validation** - Verify consistency across documents
- 🔍 **AD/CVD Check** - Identify antidumping/countervailing duty cases
- 💰 **Duty Calculation** - Calculate all applicable duties and fees
- 📊 **Compliance Scoring** - Risk assessment and compliance scoring
- 📝 **Report Generation** - Comprehensive compliance reports

## Quick Start

```bash
# Install dependencies
npm install

# Run demo
npm run dev

# Interactive CLI
npm run interactive

# Web server
npm run server
```

## Project Structure

```
cbp-compliance/
├── src/
│   ├── types.ts      # Type definitions
│   ├── tools.ts      # Custom CBP tools
│   ├── agent.ts      # Agent configuration
│   ├── cli.ts        # Interactive CLI
│   ├── server.ts     # Web server
│   └── index.ts      # Main entry
├── config/
├── package.json
└── README.md
```

## Custom Tools

This example implements 9 specialized CBP tools:

| Tool | Category | Description |
|------|----------|-------------|
| `extract_invoice` | Document | Extract commercial invoice data |
| `extract_packing_list` | Document | Extract packing list data |
| `extract_bill_of_lading` | Document | Extract B/L data |
| `extract_certificate_of_origin` | Document | Extract C/O data |
| `cross_validate_documents` | Validation | Cross-validate documents |
| `check_adcvd_case` | Compliance | Check AD/CVD applicability |
| `calculate_duties` | Compliance | Calculate duties and fees |
| `compliance_check` | Compliance | Comprehensive check |
| `generate_report` | Report | Generate report |

## Usage Examples

### Basic Compliance Check

```typescript
import { createCBPAgent, createMockCBPLLM } from './src/agent';

const llm = createMockCBPLLM();
const agent = createCBPAgent({ llm, verbose: true });

const response = await agent.process(
  'Check compliance for entry NMR-67472736',
  { entryNumber: 'NMR-67472736' }
);

console.log(response.result);
```

### With Real LLM

```typescript
import { createOpenAIClient } from '<scope>/agent-core/llm';
import { createCBPAgent } from './src/agent';

const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o'
});

const agent = createCBPAgent({ llm });
```

### Persistent Agent

```typescript
const agent = createCBPAgent({
  llm,
  persistent: true,
  storageDir: './cbp-data'
});

// Tasks are automatically saved
const response = await agent.process('Check compliance...');

// Resume later
const tasks = await agent.listTasks();
```

## CLI Commands

```bash
# Interactive mode
npm run interactive

# Run single check
npm run check -- --entry NMR-67472736

# Demo with sample data
npx tsx src/cli.ts demo
```

### Interactive Commands

```
CBP> help              - Show help
CBP> check <entry>     - Run compliance check
CBP> calculate         - Calculate duties
CBP> analyze           - Analyze documents
CBP> status            - Show agent status
CBP> exit              - Exit
```

## Web API

Start server:

```bash
npm run server
# Server at http://localhost:3000
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Web UI |
| GET | `/api/health` | Health check |
| GET | `/api/agent/status` | Agent status |
| GET | `/api/tools` | List tools |
| POST | `/api/check` | Start compliance check |
| GET | `/api/check/:id` | Get check status |
| GET | `/api/check/:id/stream` | SSE updates |
| POST | `/api/calculate` | Calculate duties |
| POST | `/api/adcvd` | Check AD/CVD |

### API Examples

```bash
# Start compliance check
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"entryNumber": "NMR-67472736"}'

# Calculate duties
curl -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"enteredValue": 28100, "hsCode": "4011.10.10", "countryOfOrigin": "Vietnam"}'

# Check AD/CVD
curl -X POST http://localhost:3000/api/adcvd \
  -H "Content-Type: application/json" \
  -d '{"hsCode": "4011.10.10", "countryOfOrigin": "Vietnam", "productDescription": "Tires"}'
```

## Sample Output

```
╔════════════════════════════════════════════════════════════╗
║          CBP Compliance Check Agent                       ║
╚════════════════════════════════════════════════════════════╝

📋 Entry Number: NMR-67472736

[Agent] Plan created with 9 steps:
  1. Extract Commercial Invoice
  2. Extract Packing List
  3. Extract Bill of Lading
  4. Extract Certificate of Origin
  5. Cross-Validate Documents
  6. Check AD/CVD Applicability
  7. Calculate Duties
  8. Perform Compliance Check
  9. Generate Compliance Report

[Tool] Extracting invoice from: invoice.pdf
✅ Completed: Extract Commercial Invoice

[Tool] Extracting packing list from: packing_list.pdf
✅ Completed: Extract Packing List

...

═══════════════════════════════════════════════════════════════
                      COMPLIANCE RESULTS
═══════════════════════════════════════════════════════════════

📊 Overall Score: 75/100
⚠️  Risk Level: ● MEDIUM

Compliance Checks:
  ✓ Document Completeness: 100% of required documents present
  ✓ Document Consistency: 3/3 cross-references match
  ⚠ AD/CVD Declaration: Subject to 2 AD/CVD case(s)
  ⚠ Transaction Valuation: Incoterms: DDP Los Angeles
  ✓ Country of Origin Documentation: Certificate of Origin present

⚠️  Issues Found:
  AD/CVD Duties Applicable
    Entry is subject to AD/CVD orders: A-552-830, C-552-831

💡 Recommendations:
  • Consider requesting new shipper review if applicable
  • Maintain detailed transaction records for annual review
  • Prepare documentation showing legitimate IOR arrangement

─────────────────────────────────────────────────────────────────
Duration: 2543ms
Steps executed: 9
```

## Compliance Report Sample

The agent generates detailed Markdown reports including:

- Entry information
- Executive summary with scores
- Detailed compliance checks
- Identified issues
- Required actions
- Duty calculations
- Recommendations

## Extending the Example

### Add Custom Tools

```typescript
import { createTool } from '<scope>/agent-core';

const myTool = createTool()
  .name('my_custom_tool')
  .description('Custom compliance tool')
  .parameter({
    name: 'input',
    type: 'string',
    required: true
  })
  .execute(async (params) => {
    // Your logic here
    return result;
  })
  .build();

// Add to agent
const agent = createCBPAgent({
  llm,
  tools: [...cbpTools, myTool]
});
```

### Custom LLM Integration

```typescript
const customLLM: LLMClient = {
  async complete(prompt) {
    // Call your LLM API
    return response;
  },
  async chat(messages) {
    // Handle chat
    return response;
  }
};

const agent = createCBPAgent({ llm: customLLM });
```

## License

MIT
