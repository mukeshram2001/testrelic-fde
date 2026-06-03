# TestRelic Smart Reporter

> AI-powered Playwright test intelligence CLI that transforms buried XML reports into actionable insights.

**Built for:** TestRelic FDE Intern Assignment — "Solve it for 10,000 customers"

---

## What Problem This Solves

Your Playwright tests run in CI. The XML report gets buried in GitHub Actions artifacts. Nobody reads it. When production breaks, you find out from Slack — not from your tests.

**Smart Reporter closes this gap.** It reads your Playwright JUnit XML and produces:

- **Plain-English narrative** of what happened and what to do about it
- **Health score** with stability, speed, and coverage metrics
- **Failure pattern analysis** — groups similar failures and suggests fixes
- **Flaky test detection** — identifies unstable tests before they erode trust
- **Action items** — prioritized, specific, actionable

## Quick Start (Beginner-Friendly Guide)

Follow these simple steps to run and view the test reporter on your computer.

### 📋 Prerequisites
You need **Node.js** installed on your system. If you don't have it, download and install the LTS version from [nodejs.org](https://nodejs.org/).

---

### Step 1: Open Your Terminal or PowerShell
* **Windows:** Press the `Win` key, type **PowerShell**, and press `Enter`.
* **macOS:** Press `Cmd + Space`, type **Terminal**, and press `Enter`.

### Step 2: Navigate to this Project Directory
Use the `cd` command (Change Directory) to enter the project folder. For example:
```bash
cd "D:\testrelic-fde-assignment"
```
*(If you downloaded this as a ZIP file, make sure to unzip it first, then navigate into the unzipped folder).*

### Step 3: Install the Project Dependencies
Run this command to download and install the required library files:
```bash
npm install
```
*Note: This might take 30-60 seconds depending on your internet connection. It creates a `node_modules` folder with all dependencies.*

### Step 4: Run the Complete Testing & Analysis Suite
Execute the main testing pipeline by running:
```bash
npm run ci
```
*What this does:* It compiles the source files, automatically runs all 30 tests in the background, and outputs a summary report in the terminal.

### Step 5: Generate and Open the Visual Web Dashboard
To view a beautiful, graphical webpage of your test health report, run:
```bash
node dist/cli.js analyze --format html --output report.html --open
```
*What this does:* This creates a file named `report.html` and automatically opens it in your default web browser (Chrome, Edge, Safari, etc.) showing a comprehensive health dashboard.

### Step 6: How to Re-Open the Report Manually
If you close your browser and want to open the report again later, run:
* **Windows:**
  ```powershell
  start report.html
  ```
* **macOS / Linux:**
  ```bash
  open report.html
  ```

---

For a detailed developer walkthrough and configuration details, check out [SETUP.md](file:///d:/testrelic-fde-assignment/SETUP.md).

## Demo Output

```
┌────────────────────────────────────────────┐
│  📊 TESTRELIC SMART REPORTER               │
│  6/2/2026, 10:30:00 AM                     │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  ⚠️ Health Score: 71/100 ➡️                │
│  Pass Rate: 83.3%  |  Tests: 6  |  ...    │
│  Good overall health with minor areas...   │
└────────────────────────────────────────────┘

📝 What Happened
4 of 6 tests passed (83.3% pass rate)... [plain English narrative]

🎯 Action Items
  🔴 Fix 1 blocking test failure pattern(s)
     AssertionError (1 occurrence)
     → Review the expected vs actual values...

  🟡 Stabilize 1 flaky test(s)
     auth-empty-submission: 0% pass rate [low confidence]
     → Add explicit waits, avoid race conditions...
```

## Architecture

```
src/
├── cli.ts           # Commander.js CLI interface (analyze, watch, config)
├── parser.ts        # JUnit XML → TestRun parser (fast-xml-parser)
├── intelligence.ts  # Analysis engine — health score, patterns, actions
├── classifier.ts    # Failure categorization (Assertion/Timeout/Selector/Network)
├── formatter.ts     # Multi-format output (terminal/json/markdown/html)
├── uploader.ts      # TestRelic cloud upload (CTRF-compatible REST API)
├── watcher.ts       # File system monitor for CI watch mode
├── types.ts         # Domain model types
└── index.ts         # Barrel exports
```

## Commands

The Smart Reporter CLI can be run locally using `node dist/cli.js <command>` (or `npx smart-reporter <command>` if symlinked/installed globally).

---

### 1. `analyze` — Generate Intelligence Report

Parses a JUnit XML report, processes it through the intelligence engine, formats the output, and optionally uploads the results.

#### Command Arguments & Flags

| Flag | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `-i, --input <path>` | string | `test-results/junit-report.xml` | Path to the JUnit XML report file to analyze. |
| `-o, --output <path>` | string | *None* | Path to write the output report file to. If omitted, prints to terminal stdout. |
| `-f, --format <format>`| string | `terminal` | Format of the report. Choices: `terminal`, `json`, `markdown`, `html`, `compact`. |
| `--no-upload` | boolean | `false` | Explicitly skips uploading report analytics to the TestRelic Cloud. |
| `--api-key <key>` | string | *None* | TestRelic API key (overrides the `TESTRELIC_API_KEY` environment variable). |
| `--project <name>` | string | `fde-assignment` | TestRelic project name for cloud analytics dashboard categorization. |
| `--open` | boolean | `false` | Automatically opens the HTML report in your default browser. (Requires `--format html` and `--output`). |
| `--fail-on-failures` | boolean | `false` | If set, the CLI process will exit with code `1` if the report contains any failed tests. |

#### Usage Examples

* **Default Terminal Dashboard:**
  ```bash
  node dist/cli.js analyze
  ```
* **Generate a JSON Report File:**
  ```bash
  node dist/cli.js analyze --input test-results/junit-report.xml --output report.json --format json
  ```
* **Generate a Visual HTML Dashboard and Auto-Open in Browser:**
  ```bash
  node dist/cli.js analyze --format html --output report.html --open
  ```
* **Run in CI Pipeline (skips upload, exits with code 1 if tests failed):**
  ```bash
  node dist/cli.js analyze --fail-on-failures --no-upload
  ```
* **Upload to TestRelic Cloud with Custom API Key & Project:**
  ```bash
  node dist/cli.js analyze --api-key "tr_api_xxxxxx" --project "production-suite"
  ```

---

### 2. `watch` — Monitor Directory for Results

Watches a folder for new or updated JUnit XML report files and automatically analyzes them in real-time.

#### Command Arguments & Flags

| Flag | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `-d, --dir <path>` | string | `test-results` | Directory to monitor for new XML files. |
| `-i, --interval <ms>`| number | `10000` | Directory polling interval in milliseconds. |
| `-f, --format <format>`| string | `terminal` | Format to output analysis summaries when files change. |
| `--api-key <key>` | string | *None* | TestRelic API key for auto-uploading discovered results. |
| `--project <name>` | string | `fde-assignment` | Project name to use for cloud dashboard uploads. |
| `--exec <command>` | string | *None* | Shell command to execute when files change (e.g. to re-run test suites). |

#### Usage Examples

* **Standard Watcher:**
  ```bash
  node dist/cli.js watch --dir test-results --interval 5000
  ```
* **Watch and Automatically Re-Run Playwright Tests on Changes:**
  ```bash
  node dist/cli.js watch --exec "npx playwright test" --interval 15000
  ```

---

### 3. `config` — Validate Setup

Displays version diagnostics, environment status, and checks if required variables like `TESTRELIC_API_KEY` are configured correctly.

#### Usage Example
```bash
node dist/cli.js config
```

## Playwright Test Suite

This repository includes a full Playwright test suite testing both the demo app and the CLI tool itself:

| Test | Coverage | Type |
|------|----------|------|
| `authentication-successful-login` | Auth redirect, dashboard render | E2E |
| `authentication-failed-login` | Error display, form validation | E2E |
| `dashboard-statistics-accuracy` | Data correctness | E2E |
| `task-management-create-new-task` | CRUD: modal, form, state update | E2E |
| `task-management-toggle-checkbox` | Interactive state, visual feedback | E2E |
| `auth-empty-submission` | **Intentional failure** for Smart Reporter demo | E2E |
| `navigation-logout-returns-to-login` | Session management | E2E |

### Running Tests

```bash
# Run all tests (headless)
npm test

# Run with browser visible
npm run test:headed

# Run with UI mode
npm run test:ui

# Run specific test
npx playwright test --grep "authentication"
```

## TestRelic Integration

### SDK Configuration

The Playwright config already includes the TestRelic reporter. Set your API key:

```bash
export TESTRELIC_API_KEY=your_api_key_here
```

Or in GitHub Actions, add `TESTRELIC_API_KEY` as a repository secret.

### MCP Server Usage

Query your test results with natural language after uploading:

```
"Which of my tests are most likely to be flaky based on the last 3 runs?"
"What's the most common failure pattern in my test suite?"
"How has my test health score changed over the past week?"
```

See `/docs/mcp-query-screenshot.png` for an example interaction.

### Dashboard Evidence

- **Dashboard Screenshot:** `/docs/testrelic-dashboard-screenshot.png`
- **MCP Query Screenshot:** `/docs/mcp-query-screenshot.png`
- **Dashboard URL:** Available after upload with your API key

## CI/CD — GitHub Actions

Tests run automatically on every push. See `.github/workflows/test.yml`:

```yaml
- Run Playwright tests
- Upload results to TestRelic cloud
- Generate Smart Reporter analysis
- Comment PR with markdown report (on pull requests)
```

**CI Status:** See the Actions tab of this repository.

## Assignment Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| Problem Decomposition | `/docs/problem.md` | Complete |
| Working Tool (CLI + Source) | `/src/`, `/bin/` | Complete |
| Playwright Test Suite (≥5 tests + 1 failure) | `/tests/e2e/`, `/tests/unit/` | Complete (7 tests) |
| TestRelic Dashboard Screenshot | `/docs/testrelic-dashboard-screenshot.png` | Complete |
| MCP Query Screenshot | `/docs/mcp-query-screenshot.png` | Complete |
| Scale Brief | `/docs/scale.md` | Complete |
| GitHub Actions CI | `.github/workflows/test.yml` | Complete |
| Demo Video | [Loom link in PR] | Optional |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| CLI Framework | Commander.js |
| XML Parsing | fast-xml-parser |
| Terminal UI | chalk, ora, boxen |
| Testing | Playwright (@playwright/test) |
| Analytics SDK | @testrelic/playwright-analytics |
| Language | TypeScript 5.4 |
| CI/CD | GitHub Actions |

## Project Structure

```
testrelic-fde-assignment/
├── bin/                          # CLI entry point
│   └── smart-reporter.js
├── src/                          # Core source code
│   ├── cli.ts                    # CLI commands
│   ├── parser.ts                 # JUnit XML parser
│   ├── intelligence.ts           # Analysis engine
│   ├── classifier.ts             # Failure classifier
│   ├── formatter.ts              # Output formatters
│   ├── uploader.ts               # TestRelic upload
│   ├── watcher.ts                # File watcher
│   ├── types.ts                  # Type definitions
│   └── index.ts                  # Barrel exports
├── tests/
│   ├── e2e/                      # Playwright E2E tests
│   │   ├── app.spec.ts           # Demo app tests
│   │   └── cli.spec.ts           # CLI tool tests
│   ├── unit/                     # Unit tests
│   │   └── parser.spec.ts        # Parser tests
│   └── fixtures/                 # Test fixtures
│       ├── demo-app/             # Demo web app
│       │   └── index.html
│       └── test-data.ts          # Shared test data
├── docs/                         # Assignment deliverables
│   ├── problem.md                # Part 1: Problem Decomposition
│   ├── scale.md                  # Part 4: Scale Brief
│   ├── testrelic-dashboard-screenshot.png
│   └── mcp-query-screenshot.png
├── .github/
│   └── workflows/
│       └── test.yml              # CI/CD pipeline
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── README.md
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run linter
npm run lint

# Type check
npm run typecheck

# Full CI simulation
npm run ci
```

## License

MIT

---

*Built with care for the TestRelic FDE Intern Assignment.*
*The difference between a good FDE and a great one is whether their work compounds — or evaporates after the call ends.*
