# TestRelic Smart Reporter — FDE Intern Assignment

> AI-powered Playwright test intelligence CLI + full-stack backend infrastructure that transforms raw XML test reports into actionable insights and streams real network telemetry to the TestRelic Cloud Dashboard.

**Candidate:** Mukeshram  
**Role:** Forward Deployed Engineering (Intern)  
**Repository:** `testrelic-fde-assignment`

---

## What Problem This Solves

Your Playwright tests run in CI. The XML report gets buried in GitHub Actions artifacts. Nobody reads it. When production breaks, you find out from Slack — not from your tests.

**Smart Reporter closes this gap.** It reads your Playwright JUnit XML and produces:

- **Plain-English narrative** of what happened and what to do about it
- **Health score** with stability, speed, and coverage metrics
- **Failure pattern analysis** — groups similar failures and suggests fixes
- **Flaky test detection** — identifies unstable tests before they erode trust
- **Action items** — prioritized, specific, actionable
- **Real network telemetry** — captured from a live Node.js backend server

---

## Project Architecture Overview

This project has two main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT 1: TaskFlow App                 │
│  tests/fixtures/demo-app/index.html  ← Frontend (webpage)   │
│  tests/fixtures/demo-app/server.js   ← Backend (REST API)   │
│                                                              │
│  API Endpoints:                                              │
│  POST /api/auth/login    ← User authentication              │
│  GET  /api/tasks         ← Fetch all tasks                  │
│  POST /api/tasks         ← Create new task                  │
│  PUT  /api/tasks/:id     ← Update task status               │
└─────────────────────────────────────────────────────────────┘
                              ↓ tested by
┌─────────────────────────────────────────────────────────────┐
│              COMPONENT 2: Smart Reporter CLI                 │
│  src/parser.ts       ← Reads JUnit XML test results         │
│  src/classifier.ts   ← Classifies failure reasons           │
│  src/intelligence.ts ← Computes 0-100 health score          │
│  src/formatter.ts    ← Formats output (terminal/json/html)  │
│  src/uploader.ts     ← Uploads report to TestRelic Cloud    │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Beginner-Friendly)

### Prerequisites
You need **Node.js** installed. Download from [nodejs.org](https://nodejs.org/) (LTS version).

### Step 1 — Clone the Repository
```bash
git clone https://github.com/mukeshram2001/testrelic-fde.git
cd testrelic-fde-assignment
```

### Step 2 — Install Dependencies
```bash
npm install
```
*This downloads all required packages into a `node_modules` folder. Takes 30-60 seconds.*

### Step 3 — Run the Full CI Pipeline
```bash
npm run ci
```

**What this does in sequence:**
1. Compiles TypeScript source files
2. Starts the Node.js backend server on port `3456`
3. Runs all Playwright tests (Chrome + Firefox in parallel)
4. Records real HTTP network calls to the backend
5. Uploads telemetry to the TestRelic Cloud via SDK
6. Runs the Smart Reporter to analyze `junit-report.xml`
7. Uploads the intelligence report to the TestRelic Cloud
8. Outputs `report.json` with health score and failure analysis

### Step 4 — View the Visual HTML Report
```bash
node dist/cli.js analyze --format html --output report.html --open
```
*Opens a visual dashboard in your browser with health scores and charts.*

---

## Backend Server (`server.js`)

The project uses a **custom Node.js HTTP server** (zero external dependencies) to serve the frontend and host a real RESTful API. Playwright tests communicate with this server, generating genuine HTTP network logs.

### API Endpoints

| Method | Endpoint | Description | Success Code |
|--------|----------|-------------|--------------|
| `POST` | `/api/auth/login` | Authenticate user | `200 OK` |
| `GET` | `/api/tasks` | Get all tasks | `200 OK` |
| `POST` | `/api/tasks` | Create new task | `201 Created` |
| `PUT` | `/api/tasks/:id` | Toggle task complete | `200 OK` |

### Test Credentials
```
Email:    user@example.com
Password: password123
```

### Database Seed (24 Tasks)
The server seeds exactly **24 tasks** on startup to match E2E assertions:
- ✅ **18 Completed** tasks (ID 2–19)
- ⏳ **4 Pending** tasks (ID 1, 20, 21, 22)
- 🔴 **2 Overdue** tasks (ID 23, 24)

### Parallel Test Isolation (`X-Client-ID`)
When Chrome and Firefox run tests simultaneously, each browser sends a unique `X-Client-ID` header. The server maintains **separate in-memory databases per client session**, preventing state pollution between parallel workers.

```javascript
// Each browser gets its own isolated task database
const clientTasks = {};        // { 'client-abc': [...tasks] }
const clientNextIds = {};      // { 'client-abc': 25 }
```

---

## Smart Reporter CLI

### Commands

#### `analyze` — Generate Intelligence Report
```bash
node dist/cli.js analyze [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-i, --input <path>` | `test-results/junit-report.xml` | JUnit XML input file |
| `-o, --output <path>` | *(stdout)* | Output file path |
| `-f, --format <format>` | `terminal` | `terminal`, `json`, `markdown`, `html`, `compact` |
| `--api-key <key>` | *(env var)* | TestRelic API key |
| `--fail-on-failures` | `false` | Exit code 1 if tests failed |
| `--open` | `false` | Auto-open HTML in browser |

**Examples:**
```bash
# Terminal output (default)
node dist/cli.js analyze

# JSON report file
node dist/cli.js analyze --output report.json --format json

# HTML dashboard, auto-opens browser
node dist/cli.js analyze --format html --output report.html --open

# CI mode — exits with error code if tests failed
node dist/cli.js analyze --fail-on-failures
```

#### `watch` — Monitor for New Results
```bash
node dist/cli.js watch --dir test-results --interval 5000
```
Watches a directory for new XML files and auto-analyzes them in real-time.

#### `config` — Check Setup
```bash
node dist/cli.js config
```
Shows environment variables, API key status, and Node.js version.

---

## Playwright Test Suite

All E2E tests use the `@testrelic/playwright-analytics` fixture for real-time cloud telemetry upload.

| Test Name | What It Tests | Expected Result |
|-----------|--------------|-----------------|
| `authentication-successful-login` | Login with correct credentials | Dashboard appears |
| `authentication-failed-login` | Login with wrong credentials | Error message shown |
| `dashboard-statistics-match-expected-values` | Stats counters on dashboard | Total:24, Done:18, Pending:4, Overdue:2 |
| `task-management-create-new-task` | Add task via modal | New task appears in list, stats update |
| `task-management-toggle-checkbox` | Click task checkbox | Status toggles, API PUT called |
| `task-management-empty-title-validation` | Submit empty task form | Validation error shown |
| `navigation-logout-returns-to-login-page` | Click logout | Login page appears |
| `task-management-modal-cancellation` | Cancel/overlay-click modal | Modal closes, no task added |
| `special-scenario-flaky-test` | Randomly passes/fails | Demonstrates flaky detection |
| `special-scenario-failing-assertion` | ❌ Intentional failure | Generates AssertionError for Smart Reporter |
| `special-scenario-intentional-timeout` | ❌ Intentional timeout | Generates TimeoutError for Smart Reporter |

> **Why intentional failures?** Tests #10 and #11 are *designed* to fail. They prove that the Smart Reporter and TestRelic Dashboard can correctly detect, classify, and explain different failure types.

### Running Tests
```bash
# All tests (headless — no browser window)
npm test

# With visible browser window
npm run test:headed

# Interactive UI mode
npm run test:ui

# Specific test by name
npx playwright test --grep "authentication"

# Full CI pipeline
npm run ci
```

---

## TestRelic Cloud Integration

### Two Upload Pathways

**Pathway 1 — Playwright Analytics SDK** (runs during tests):
- Hooks into every browser page
- Records HTTP network calls (auth, tasks CRUD)
- Streams traces, DOM states, and timings to TestRelic cloud in real-time

**Pathway 2 — Smart Reporter CLI** (runs after tests):
- Reads `junit-report.xml`
- Analyzes failures, flakiness, and health score
- Uploads intelligence report via REST API:
  ```
  POST /sdk/auth/token    → Get JWT token
  POST /repos/resolve     → Match git remote to repo ID
  POST /runs/init         → Open a new test run session
  POST /runs/:id/tests    → Stream test results
  POST /runs/:id/finalize → Commit and publish run
  ```

### Setting Up API Key
```bash
# Set environment variable
export TESTRELIC_API_KEY=your_api_key_here

# Or pass directly to CLI
node dist/cli.js analyze --api-key tr_live_xxxxx
```

### Verifying Network Logs on Dashboard
1. Go to [platform.testrelic.ai](https://platform.testrelic.ai)
2. Open **Test Runs** → select your latest run
3. Click any E2E test (e.g., `dashboard-statistics-match-expected-values`)
4. Click the **Network** tab
5. You will see:
   - `POST login` — Status 200 (authentication request)
   - `GET tasks` — Status 200 (task list fetch)
   - `POST tasks` — Status 201 (task creation)
   - `PUT tasks/:id` — Status 200 (checkbox update)

### MCP Server (AI Query Interface)
After uploading, query your results with natural language:
```
"Which tests are most likely to be flaky?"
"What is the most common failure pattern?"
"How has my health score changed over the past week?"
```

---

## Project Structure

```
testrelic-fde-assignment/
├── README.md                         ← You are here
├── SUBMISSION.md                     ← Deliverables checklist
├── package.json                      ← Scripts & dependencies
├── playwright.config.ts              ← Playwright + TestRelic reporter config
├── tsconfig.json                     ← TypeScript config
│
├── src/                              ← Smart Reporter source code
│   ├── cli.ts                        ← CLI commands (analyze, watch, config)
│   ├── parser.ts                     ← JUnit XML parser
│   ├── intelligence.ts               ← Health score + analysis engine
│   ├── classifier.ts                 ← Failure categorizer
│   ├── formatter.ts                  ← Output formatters (terminal/json/html)
│   ├── uploader.ts                   ← TestRelic cloud upload
│   ├── watcher.ts                    ← File system watcher
│   ├── types.ts                      ← TypeScript type definitions
│   └── index.ts                      ← Barrel exports
│
├── tests/
│   ├── e2e/
│   │   ├── app.spec.ts               ← 11 E2E tests (TaskFlow app)
│   │   └── cli.spec.ts               ← CLI smoke tests
│   ├── unit/
│   │   └── parser.spec.ts            ← JUnit parser unit tests
│   └── fixtures/
│       ├── demo-app/
│       │   ├── index.html            ← TaskFlow frontend (webpage)
│       │   └── server.js             ← Node.js backend CRUD API server
│       └── test-data.ts              ← Shared test data
│
├── docs/
│   ├── problem.md                    ← Part 1: Problem Decomposition
│   ├── scale.md                      ← Part 4: Scale Brief
│   ├── project_architecture_report.md ← Full technical deep-dive
│   ├── testrelic-dashboard-screenshot.png
│   ├── mcp-query-screenshot.png
│   └── testrelic-network-logs-proof.png ← Network capture verification
│
└── .github/
    └── workflows/
        └── test.yml                  ← CI/CD pipeline (GitHub Actions)
```

---

## CI/CD Pipeline

Tests run automatically on every push via GitHub Actions (`.github/workflows/test.yml`):

```yaml
jobs:
  - Build TypeScript
  - Run Playwright E2E tests (Chrome + Firefox)
  - Upload results to TestRelic Cloud
  - Run Smart Reporter analysis
  - Comment on PR with markdown summary
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend Server | Node.js HTTP (zero dependencies) |
| Frontend | Vanilla HTML + CSS + JavaScript |
| CLI Framework | Commander.js |
| XML Parsing | fast-xml-parser |
| Terminal UI | chalk, ora, boxen |
| Testing | Playwright (@playwright/test) |
| Analytics SDK | @testrelic/playwright-analytics |
| Language | TypeScript 5.4 |
| CI/CD | GitHub Actions |

---

## Assignment Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| Problem Decomposition | `/docs/problem.md` | ✅ Complete |
| Working CLI Tool | `/src/`, `/bin/` | ✅ Complete |
| Backend CRUD Server | `/tests/fixtures/demo-app/server.js` | ✅ Complete |
| Playwright Test Suite (≥5 tests) | `/tests/e2e/app.spec.ts` | ✅ Complete (11 tests) |
| TestRelic Dashboard Screenshot | `/docs/testrelic-dashboard-screenshot.png` | ✅ Complete |
| Network Logs Proof Screenshot | `/docs/testrelic-network-logs-proof.png` | ✅ Complete |
| MCP Query Screenshot | `/docs/mcp-query-screenshot.png` | ✅ Complete |
| Scale Brief | `/docs/scale.md` | ✅ Complete |
| Technical Architecture Report | `/docs/project_architecture_report.md` | ✅ Complete |
| GitHub Actions CI | `.github/workflows/test.yml` | ✅ Complete |

---

## Development Commands

```bash
npm install          # Install all dependencies
npm run build        # Compile TypeScript → JavaScript
npm run dev          # Watch mode (auto-recompile on changes)
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type check (no emit)
npm test             # Run Playwright tests only
npm run ci           # Full pipeline: build + test + analyze + upload
```

---

*Built for the TestRelic FDE Intern Assignment.*  
*"Every solution you build for one customer must contain the seeds of a solution that works for ten thousand customers."*
