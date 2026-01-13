// ============================================
// CBP Compliance - Web Server
// ============================================

import express, { Request, Response } from 'express';
import { createCBPAgent, createMockCBPLLM } from './agent';
import { ComplianceCheckResult } from './types';

const app = express();
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// -------------------- Agent Instance --------------------

const llm = createMockCBPLLM();
const agent = createCBPAgent({ llm, verbose: true });

// Store active tasks
const activeTasks = new Map<string, {
  status: string;
  progress: number;
  steps: any[];
  result?: any;
  error?: string;
}>();

// -------------------- API Routes --------------------

/**
 * Health check
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CBP Compliance Agent',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get agent status
 */
app.get('/api/agent/status', (req: Request, res: Response) => {
  res.json({
    state: agent.getState(),
    toolsAvailable: 22,
    activeTasks: activeTasks.size
  });
});

/**
 * List available tools
 */
app.get('/api/tools', (req: Request, res: Response) => {
  const tools = [
    { name: 'extract_invoice', category: 'document', description: 'Extract commercial invoice data' },
    { name: 'extract_packing_list', category: 'document', description: 'Extract packing list data' },
    { name: 'extract_bill_of_lading', category: 'document', description: 'Extract B/L data' },
    { name: 'extract_certificate_of_origin', category: 'document', description: 'Extract C/O data' },
    { name: 'cross_validate_documents', category: 'validation', description: 'Cross-validate documents' },
    { name: 'check_adcvd_case', category: 'compliance', description: 'Check AD/CVD applicability' },
    { name: 'calculate_duties', category: 'compliance', description: 'Calculate duties and fees' },
    { name: 'compliance_check', category: 'compliance', description: 'Comprehensive compliance check' },
    { name: 'generate_report', category: 'report', description: 'Generate compliance report' }
  ];
  
  res.json({ tools });
});

/**
 * Start compliance check
 */
app.post('/api/check', async (req: Request, res: Response) => {
  const { entryNumber, documents } = req.body;

  if (!entryNumber) {
    return res.status(400).json({ error: 'Entry number is required' });
  }

  const taskId = `task_${Date.now()}`;

  // Initialize task tracking
  activeTasks.set(taskId, {
    status: 'running',
    progress: 0,
    steps: []
  });

  // Return task ID immediately
  res.json({
    taskId,
    message: 'Compliance check started',
    status: 'running'
  });

  // Run check asynchronously
  try {
    const task = activeTasks.get(taskId)!;

    // Listen for progress
    const stepHandler = ({ stepName, stepId }: any) => {
      task.steps.push({ stepId, stepName, status: 'running', startedAt: new Date().toISOString() });
      task.progress = Math.min(90, task.progress + 10);
    };

    const completeHandler = ({ result }: any) => {
      const step = task.steps.find(s => s.stepName === result.stepName);
      if (step) {
        step.status = result.status;
        step.completedAt = new Date().toISOString();
      }
    };

    agent.on('step:start', stepHandler);
    agent.on('step:complete', completeHandler);

    const response = await agent.process(
      `Perform comprehensive compliance check for entry ${entryNumber}`,
      { entryNumber, documents }
    );

    agent.off('step:start', stepHandler);
    agent.off('step:complete', completeHandler);

    task.status = response.success ? 'completed' : 'failed';
    task.progress = 100;
    task.result = response.result;
    if (response.error) {
      task.error = response.error;
    }

  } catch (error: any) {
    const task = activeTasks.get(taskId);
    if (task) {
      task.status = 'error';
      task.error = error.message;
    }
  }
});

/**
 * Get task status
 */
app.get('/api/check/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    taskId,
    ...task
  });
});

/**
 * Calculate duties
 */
app.post('/api/calculate', async (req: Request, res: Response) => {
  const { enteredValue, hsCode, countryOfOrigin } = req.body;

  if (!enteredValue || !hsCode) {
    return res.status(400).json({ error: 'Entered value and HS code are required' });
  }

  try {
    const response = await agent.process(
      `Calculate duties for merchandise worth $${enteredValue} with HS code ${hsCode} from ${countryOfOrigin || 'Unknown'}`,
      { enteredValue, hsCode, countryOfOrigin }
    );

    res.json({
      success: response.success,
      result: response.result,
      duration: response.duration
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check AD/CVD applicability
 */
app.post('/api/adcvd', async (req: Request, res: Response) => {
  const { hsCode, countryOfOrigin, productDescription } = req.body;

  if (!hsCode || !countryOfOrigin) {
    return res.status(400).json({ error: 'HS code and country of origin are required' });
  }

  try {
    const response = await agent.process(
      `Check AD/CVD applicability for ${productDescription || 'merchandise'} with HS code ${hsCode} from ${countryOfOrigin}`,
      { hsCode, countryOfOrigin, productDescription }
    );

    res.json({
      success: response.success,
      result: response.result
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------- Server-Sent Events for Real-time Updates --------------------

app.get('/api/check/:taskId/stream', (req: Request, res: Response) => {
  const { taskId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send current status
  const task = activeTasks.get(taskId);
  if (task) {
    sendEvent('status', { taskId, ...task });
  }

  // Poll for updates
  const interval = setInterval(() => {
    const task = activeTasks.get(taskId);
    if (task) {
      sendEvent('progress', {
        taskId,
        status: task.status,
        progress: task.progress,
        steps: task.steps.length
      });

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'error') {
        sendEvent('complete', { taskId, ...task });
        clearInterval(interval);
        res.end();
      }
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// -------------------- Static HTML for Demo --------------------

app.get('/', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>CBP Compliance Agent</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
           max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    input, button { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
    button { background: #007bff; color: white; cursor: pointer; border: none; }
    button:hover { background: #0056b3; }
    pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .progress { height: 20px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
    .progress-bar { height: 100%; background: #28a745; transition: width 0.3s; }
    .status { padding: 5px 10px; border-radius: 4px; display: inline-block; }
    .status.running { background: #ffc107; }
    .status.completed { background: #28a745; color: white; }
    .status.failed { background: #dc3545; color: white; }
  </style>
</head>
<body>
  <h1>🛃 CBP Compliance Agent</h1>
  
  <div class="card">
    <h2>Run Compliance Check</h2>
    <input type="text" id="entryNumber" placeholder="Entry Number" value="NMR-67472736">
    <button onclick="runCheck()">Start Check</button>
    <div id="progress" style="margin-top: 15px; display: none;">
      <div class="progress"><div class="progress-bar" id="progressBar" style="width: 0%"></div></div>
      <p>Status: <span class="status" id="status">-</span></p>
    </div>
  </div>
  
  <div class="card">
    <h2>Calculate Duties</h2>
    <input type="number" id="value" placeholder="Entered Value" value="28100">
    <input type="text" id="hsCode" placeholder="HS Code" value="4011.10.10">
    <input type="text" id="origin" placeholder="Origin" value="Vietnam">
    <button onclick="calculateDuties()">Calculate</button>
  </div>
  
  <div class="card">
    <h2>Results</h2>
    <pre id="results">Results will appear here...</pre>
  </div>
  
  <script>
    async function runCheck() {
      const entryNumber = document.getElementById('entryNumber').value;
      document.getElementById('progress').style.display = 'block';
      
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryNumber })
      });
      
      const { taskId } = await res.json();
      
      // Start SSE for updates
      const events = new EventSource('/api/check/' + taskId + '/stream');
      
      events.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        document.getElementById('progressBar').style.width = data.progress + '%';
        document.getElementById('status').textContent = data.status;
        document.getElementById('status').className = 'status ' + data.status;
      });
      
      events.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        document.getElementById('results').textContent = JSON.stringify(data.result, null, 2);
        events.close();
      });
    }
    
    async function calculateDuties() {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enteredValue: parseFloat(document.getElementById('value').value),
          hsCode: document.getElementById('hsCode').value,
          countryOfOrigin: document.getElementById('origin').value
        })
      });
      
      const data = await res.json();
      document.getElementById('results').textContent = JSON.stringify(data.result, null, 2);
    }
  </script>
</body>
</html>
  `);
});

// -------------------- Start Server --------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          CBP Compliance Agent - Web Server                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  /                    - Web UI`);
  console.log(`  GET  /api/health          - Health check`);
  console.log(`  GET  /api/agent/status    - Agent status`);
  console.log(`  GET  /api/tools           - List tools`);
  console.log(`  POST /api/check           - Start compliance check`);
  console.log(`  GET  /api/check/:id       - Get check status`);
  console.log(`  GET  /api/check/:id/stream - SSE updates`);
  console.log(`  POST /api/calculate       - Calculate duties`);
  console.log(`  POST /api/adcvd           - Check AD/CVD`);
  console.log('');
});

export default app;
