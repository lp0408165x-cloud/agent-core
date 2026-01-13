#!/usr/bin/env node
// ============================================
// CBP Compliance - Interactive CLI
// ============================================

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { createCBPAgent, createMockCBPLLM } from './agent';
import { ComplianceCheckResult } from './types';

const program = new Command();

// -------------------- Styling --------------------

const styles = {
  title: chalk.bold.cyan,
  subtitle: chalk.dim,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,
  dim: chalk.dim,
  bold: chalk.bold
};

function printHeader() {
  console.log('\n');
  console.log(styles.title('╔════════════════════════════════════════════════════════════╗'));
  console.log(styles.title('║') + chalk.bold.white('          CBP Compliance Check Agent                       ') + styles.title('║'));
  console.log(styles.title('║') + styles.dim('          Powered by Agent Core                             ') + styles.title('║'));
  console.log(styles.title('╚════════════════════════════════════════════════════════════╝'));
  console.log('');
}

function printRiskLevel(level: string) {
  switch (level) {
    case 'low':
      return styles.success('● LOW');
    case 'medium':
      return styles.warning('● MEDIUM');
    case 'high':
      return styles.error('● HIGH');
    case 'critical':
      return chalk.bgRed.white(' CRITICAL ');
    default:
      return level;
  }
}

function printScore(score: number) {
  if (score >= 90) return styles.success(`${score}/100`);
  if (score >= 70) return styles.warning(`${score}/100`);
  return styles.error(`${score}/100`);
}

// -------------------- Check Command --------------------

async function runCheck(options: { entry?: string; verbose?: boolean }) {
  printHeader();

  const spinner = ora('Initializing CBP Compliance Agent...').start();

  try {
    // Create agent with mock LLM for demo
    const llm = createMockCBPLLM();
    const agent = createCBPAgent({
      llm,
      verbose: options.verbose
    });

    spinner.succeed('Agent initialized');

    // Get entry number
    let entryNumber = options.entry;
    if (!entryNumber) {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'entryNumber',
          message: 'Enter CBP Entry Number:',
          default: 'NMR-67472736'
        }
      ]);
      entryNumber = answer.entryNumber;
    }

    console.log('');
    console.log(styles.info(`📋 Entry Number: ${entryNumber}`));
    console.log('');

    // Run compliance check
    spinner.start('Running compliance check...');

    const task = `Perform comprehensive compliance check for CBP entry ${entryNumber}. 
    Analyze all documents, cross-validate data, check AD/CVD applicability, 
    calculate duties, and generate a detailed compliance report.`;

    // Listen for events
    let currentStep = '';
    agent.on('step:start', ({ stepName }) => {
      currentStep = stepName;
      spinner.text = `Processing: ${stepName}`;
    });

    agent.on('step:complete', ({ result }) => {
      if (result.status === 'completed') {
        spinner.succeed(`Completed: ${result.stepName}`);
        spinner.start('Processing...');
      }
    });

    const response = await agent.process(task, { entryNumber });

    spinner.stop();

    // Display results
    console.log('');
    console.log(styles.title('═══════════════════════════════════════════════════════════════'));
    console.log(styles.title('                      COMPLIANCE RESULTS                        '));
    console.log(styles.title('═══════════════════════════════════════════════════════════════'));
    console.log('');

    if (response.success && response.result) {
      // Parse the report from the result
      const result = response.result;
      
      // If result contains compliance check data
      if (typeof result === 'object') {
        const compliance = result as any;
        
        if (compliance.overallScore !== undefined) {
          console.log(styles.bold('📊 Overall Score: ') + printScore(compliance.overallScore));
          console.log(styles.bold('⚠️  Risk Level: ') + printRiskLevel(compliance.riskLevel));
          console.log('');
          
          // Show checks
          if (compliance.checks) {
            console.log(styles.subtitle('Compliance Checks:'));
            for (const check of compliance.checks) {
              const status = check.status === 'pass' ? styles.success('✓') :
                check.status === 'warning' ? styles.warning('⚠') : styles.error('✗');
              console.log(`  ${status} ${check.name}: ${check.details}`);
            }
            console.log('');
          }
          
          // Show issues
          if (compliance.issues && compliance.issues.length > 0) {
            console.log(styles.warning('⚠️  Issues Found:'));
            for (const issue of compliance.issues) {
              console.log(`  ${styles.bold(issue.title)}`);
              console.log(`    ${styles.dim(issue.description)}`);
            }
            console.log('');
          }
          
          // Show recommendations
          if (compliance.recommendations && compliance.recommendations.length > 0) {
            console.log(styles.info('💡 Recommendations:'));
            for (const rec of compliance.recommendations) {
              console.log(`  • ${rec}`);
            }
            console.log('');
          }
        }
      }
      
      // If result is a string (report)
      if (typeof result === 'string') {
        console.log(result);
      }
    } else {
      console.log(styles.error('Compliance check failed'));
      if (response.error) {
        console.log(styles.error(`Error: ${response.error}`));
      }
    }

    // Summary
    console.log('');
    console.log(styles.dim('─'.repeat(60)));
    console.log(styles.dim(`Duration: ${response.duration}ms`));
    console.log(styles.dim(`Steps executed: ${response.stepResults?.length || 0}`));
    console.log('');

  } catch (error) {
    spinner.fail('Error occurred');
    console.error(styles.error(`Error: ${error}`));
    process.exit(1);
  }
}

// -------------------- Interactive Mode --------------------

async function runInteractive() {
  printHeader();

  console.log(styles.info('Welcome to CBP Compliance Agent Interactive Mode'));
  console.log(styles.dim('Type "help" for available commands, "exit" to quit'));
  console.log('');

  const llm = createMockCBPLLM();
  const agent = createCBPAgent({ llm, verbose: true });

  while (true) {
    const { command } = await inquirer.prompt([
      {
        type: 'input',
        name: 'command',
        message: styles.info('CBP>'),
        prefix: ''
      }
    ]);

    const cmd = command.trim().toLowerCase();

    if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
      console.log(styles.dim('Goodbye!'));
      break;
    }

    if (cmd === 'help' || cmd === 'h') {
      console.log('');
      console.log(styles.bold('Available Commands:'));
      console.log('  check <entry>  - Run compliance check for an entry');
      console.log('  analyze        - Analyze uploaded documents');
      console.log('  calculate      - Calculate duties for an entry');
      console.log('  status         - Show agent status');
      console.log('  clear          - Clear screen');
      console.log('  help           - Show this help');
      console.log('  exit           - Exit the program');
      console.log('');
      continue;
    }

    if (cmd === 'clear' || cmd === 'cls') {
      console.clear();
      printHeader();
      continue;
    }

    if (cmd === 'status') {
      console.log('');
      console.log(styles.bold('Agent Status:'));
      console.log(`  State: ${agent.getState()}`);
      console.log(`  Tools: ${9} CBP tools + ${13} default tools`);
      console.log('');
      continue;
    }

    if (cmd.startsWith('check')) {
      const entry = cmd.replace('check', '').trim() || 'NMR-67472736';
      console.log('');
      const spinner = ora(`Running compliance check for ${entry}...`).start();
      
      try {
        const response = await agent.process(
          `Check compliance for entry ${entry}`,
          { entryNumber: entry }
        );
        
        spinner.succeed('Check complete');
        console.log(`Result: ${response.success ? 'PASS' : 'FAIL'}`);
        console.log(`Duration: ${response.duration}ms`);
      } catch (e) {
        spinner.fail('Check failed');
      }
      console.log('');
      continue;
    }

    if (cmd.startsWith('calculate')) {
      const { value, hsCode, origin } = await inquirer.prompt([
        {
          type: 'number',
          name: 'value',
          message: 'Entered Value (USD):',
          default: 28100
        },
        {
          type: 'input',
          name: 'hsCode',
          message: 'HS Code:',
          default: '4011.10.10'
        },
        {
          type: 'input',
          name: 'origin',
          message: 'Country of Origin:',
          default: 'Vietnam'
        }
      ]);

      console.log('');
      const spinner = ora('Calculating duties...').start();
      
      try {
        const response = await agent.process(
          `Calculate duties for merchandise with value $${value}, HS code ${hsCode}, from ${origin}`,
          { value, hsCode, origin }
        );
        
        spinner.succeed('Calculation complete');
        console.log(JSON.stringify(response.result, null, 2));
      } catch (e) {
        spinner.fail('Calculation failed');
      }
      console.log('');
      continue;
    }

    if (cmd.startsWith('analyze')) {
      console.log('');
      console.log(styles.dim('Analyzing documents...'));
      const response = await agent.process('Analyze all uploaded documents and extract key information');
      console.log(`Result: ${JSON.stringify(response.result, null, 2)}`);
      console.log('');
      continue;
    }

    // Default: process as natural language task
    if (cmd.length > 0) {
      console.log('');
      const spinner = ora('Processing...').start();
      
      try {
        const response = await agent.process(cmd);
        spinner.stop();
        
        if (response.success) {
          console.log(styles.success('✓ Complete'));
          if (response.result) {
            console.log(typeof response.result === 'string' 
              ? response.result 
              : JSON.stringify(response.result, null, 2));
          }
        } else {
          console.log(styles.error('✗ Failed'));
          if (response.error) console.log(styles.error(response.error));
        }
      } catch (e) {
        spinner.fail('Error');
        console.error(e);
      }
      console.log('');
    }
  }
}

// -------------------- Main --------------------

program
  .name('cbp-compliance')
  .description('CBP Compliance Check Agent')
  .version('1.0.0');

program
  .command('check')
  .description('Run compliance check for a CBP entry')
  .option('-e, --entry <number>', 'CBP entry number')
  .option('-v, --verbose', 'Verbose output')
  .action(runCheck);

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(runInteractive);

program
  .command('demo')
  .description('Run demo with sample data')
  .action(async () => {
    await runCheck({ entry: 'NMR-67472736', verbose: true });
  });

// Default to interactive if no command
if (process.argv.length <= 2) {
  runInteractive();
} else {
  program.parse();
}
