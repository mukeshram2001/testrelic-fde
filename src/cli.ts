/**
 * CLI Entry Point — Smart Reporter
 * Commands: analyze, watch, config
 * Built with Commander.js for robust argument parsing
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { JUnitParser } from './parser.js';
import { IntelligenceEngine } from './intelligence.js';
import { ReportFormatter } from './formatter.js';
import { TestRelicUploader } from './uploader.js';
import { FileWatcher } from './watcher.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('smart-reporter')
  .description('AI-powered Playwright test intelligence — transforms XML reports into actionable insights')
  .version(pkg.version);

// ═══════════════════════════════════════════════════════════════
// ANALYZE COMMAND — Process a JUnit XML file and output report
// ═══════════════════════════════════════════════════════════════
program
  .command('analyze')
  .description('Analyze a JUnit XML report and generate an intelligence report')
  .option('-i, --input <path>', 'Path to JUnit XML file', 'test-results/junit-report.xml')
  .option('-o, --output <path>', 'Output file path (optional)')
  .option('-f, --format <format>', 'Output format: terminal, json, markdown, html, compact', 'terminal')
  .option('--no-upload', 'Skip uploading to TestRelic cloud')
  .option('--api-key <key>', 'TestRelic API key (or set TESTRELIC_API_KEY env var)')
  .option('--project <name>', 'TestRelic project name', 'fde-assignment')
  .option('--open', 'Open HTML report in browser after generation')
  .option('--fail-on-failures', 'Exit with code 1 if the report contains failed tests', false)
  .action(async (options) => {
    const spinner = ora('Reading JUnit XML...').start();

    try {
      // Validate input file exists
      if (!fs.existsSync(options.input)) {
        spinner.fail(`Input file not found: ${options.input}`);
        console.log(chalk.yellow('Tip: Run Playwright tests first with: npx playwright test'));
        process.exit(1);
      }

      // Parse XML
      spinner.text = 'Parsing test results...';
      const parser = new JUnitParser();
      const testRun = parser.parseFile(options.input);

      // Generate intelligence
      spinner.text = 'Analyzing test intelligence...';
      const engine = new IntelligenceEngine(testRun);
      const report = engine.generateReport();

      // Format output
      spinner.text = 'Formatting report...';
      const formatter = new ReportFormatter(report);

      let output: string;
      switch (options.format) {
        case 'json':
          output = formatter.toJSON();
          break;
        case 'markdown':
          output = formatter.toMarkdown();
          break;
        case 'html':
          output = formatter.toHTML();
          break;
        case 'compact':
          output = formatter.toCompact();
          break;
        case 'terminal':
        default:
          output = formatter.toTerminal();
          break;
      }

      spinner.succeed('Analysis complete!');

      // Write or print output
      if (options.output) {
        fs.mkdirSync(path.dirname(options.output), { recursive: true });
        fs.writeFileSync(options.output, output);
        console.log(chalk.green(`✓ Report written to ${options.output}`));
      } else {
        console.log(output);
      }

      // Upload to TestRelic if requested
      if (options.upload !== false) {
        const apiKey = options.apiKey || process.env.TESTRELIC_API_KEY;
        if (apiKey) {
          const uploadSpinner = ora('Uploading to TestRelic...').start();
          try {
            const uploader = new TestRelicUploader({ apiKey, projectName: options.project });
            await uploader.upload(report);
            uploadSpinner.succeed('Uploaded to TestRelic successfully');
          } catch (err: any) {
            uploadSpinner.fail(`Upload failed: ${err.message}`);
            console.log(chalk.gray('Tip: Check your API key at platform.testrelic.ai'));
          }
        } else if (options.upload === false) {
          // Explicitly skipped
        } else {
          console.log(chalk.gray('ℹ Set TESTRELIC_API_KEY to upload results to the cloud dashboard'));
        }
      }

      // Open browser if requested (HTML format only)
      if (options.open && options.format === 'html' && options.output) {
        try {
          const openModule = await import('open');
          const openFn = (openModule as any).default || openModule;
          await openFn(options.output);
        } catch {
          console.log(chalk.yellow('ℹ Install "open" package to auto-open reports: npm install open'));
        }
      }

      // Exit with appropriate code
      process.exit((options.failOnFailures && report.summary.failed > 0) ? 1 : 0);

    } catch (err: any) {
      spinner.fail(`Error: ${err.message}`);
      console.error(chalk.red(err.stack));
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// WATCH COMMAND — Watch a directory for new test results
// ═══════════════════════════════════════════════════════════════
program
  .command('watch')
  .description('Watch a directory for new JUnit XML files and auto-analyze')
  .option('-d, --dir <path>', 'Directory to watch', 'test-results')
  .option('-i, --interval <ms>', 'Polling interval in milliseconds', '10000')
  .option('-f, --format <format>', 'Output format', 'terminal')
  .option('--api-key <key>', 'TestRelic API key')
  .option('--project <name>', 'TestRelic project name', 'fde-assignment')
  .option('--exec <command>', 'Command to run when changes detected')
  .action(async (options) => {
    console.log(chalk.cyan(`👁️  Watching ${options.dir} for test results...`));
    console.log(chalk.gray(`   Interval: ${options.interval}ms | Format: ${options.format}`));
    console.log(chalk.gray('   Press Ctrl+C to stop\n'));

    const watcher = new FileWatcher({
      directory: options.dir,
      interval: parseInt(options.interval, 10),
      onNewFile: async (filePath: string) => {
        console.log(chalk.blue(`\n📄 New file detected: ${path.basename(filePath)}`));

        try {
          const parser = new JUnitParser();
          const testRun = parser.parseFile(filePath);
          const engine = new IntelligenceEngine(testRun);
          const report = engine.generateReport();
          const formatter = new ReportFormatter(report);

          console.log(formatter.toTerminal());

          // Auto-upload if API key available
          const apiKey = options.apiKey || process.env.TESTRELIC_API_KEY;
          if (apiKey) {
            const uploader = new TestRelicUploader({ apiKey, projectName: options.project });
            await uploader.upload(report).catch(() => {});
          }
        } catch (err: any) {
          console.error(chalk.red(`Error analyzing ${filePath}: ${err.message}`));
        }
      },
      onRunCommand: options.exec ? async () => {
        try {
          const execaModule = await import('execa');
          const execaFn = (execaModule as any).execa || execaModule;
          console.log(chalk.blue(`\n⚡ Running: ${options.exec}`));
          await execaFn(options.exec, { shell: true, stdio: 'inherit' });
        } catch {
          // Command failure is expected if tests fail
        }
      } : undefined,
    });

    await watcher.start();
  });

// ═══════════════════════════════════════════════════════════════
// CONFIG COMMAND — Show configuration and validate setup
// ═══════════════════════════════════════════════════════════════
program
  .command('config')
  .description('Display current configuration and validate setup')
  .action(() => {
    console.log(chalk.bold.cyan('⚙️  Smart Reporter Configuration'));
    console.log('');
    console.log(`Version:     ${pkg.version}`);
    console.log(`Node.js:     ${process.version}`);
    console.log(`Platform:    ${process.platform}`);
    console.log('');
    console.log(chalk.bold('Environment Variables:'));
    console.log(`TESTRELIC_API_KEY: ${process.env.TESTRELIC_API_KEY ? chalk.green('✓ set') : chalk.yellow('✗ not set')}`);
    console.log(`CI:                ${process.env.CI ? chalk.green('✓ ' + process.env.CI) : chalk.gray('not set')}`);
    console.log('');
    console.log(chalk.bold('Quick Start:'));
    console.log('  1. Run tests:        npx playwright test');
    console.log('  2. Analyze results:  npx smart-reporter analyze');
    console.log('  3. Or watch live:    npx smart-reporter watch');
    console.log('');
    console.log(chalk.gray('Documentation: https://docs.testrelic.ai'));
  });

// Run the CLI
program.parse();
