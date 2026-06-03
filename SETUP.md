# 🛠️ Setup & Running Guide: TestRelic Smart Reporter

This guide explains how to set up, run, and demonstrate this project step-by-step, including details on the custom fixes implemented to ensure a smooth, non-blocking pipeline.

---

## 1. Quick Setup (Local Dev)

To set up the project from scratch, run these commands in your terminal:

```bash
# 1. Install all dependencies
npm install

# 2. Build the TypeScript files
npm run build
```

---

## 2. Running the Full Pipeline

The recommended way to run the complete build, test, and analysis cycle is:

```bash
npm run ci
```

### What this single command does:
1. **Compiles** the TypeScript source code (`npm run build`).
2. **Runs Playwright E2E and unit tests** (`npx playwright test`).
3. **Gracefully handles the E2E failures** (the intentional failure in test #6 won't crash or stop the script).
4. **Automatically analyzes** the test results and generates the plain-English intelligence report in `report.json`.

---

## 3. Key Fixes Implemented

If anyone asks how you configured the project to prevent common E2E pipeline issues:

| Fix | Problem Solved | File Location |
|-----|----------------|---------------|
| **HTML Report Non-Blocking** | The Playwright HTML reporter was starting a local web server (`localhost:9323`) on test failures and blocking the terminal. We set `open: 'never'` so that reports generate quietly in the background without blocking. | [`playwright.config.ts`](./playwright.config.ts) |
| **Fail-Safe CI Script** | If Playwright tests failed, standard `&&` chaining stopped the execution immediately. We updated the script sequence to `(npx playwright test \|\| cd .) && npm run report:analyze` so that report analysis always runs even if tests fail. | [`package.json`](./package.json) |

---

## 4. How to View the Reports Manually

Once you have run the tests, you can view the reports in three formats:

### 📄 Plain JSON Report
Open the generated [`report.json`](./report.json) file directly in your editor.

### 💻 Colorful Terminal Dashboard
Run the analyzer command to see a beautifully formatted terminal interface:
```bash
node dist/cli.js analyze --input test-results/junit-report.xml
```

### 🌐 Visual HTML Report
To view the standard Playwright HTML report in your browser:
```bash
npx playwright show-report
```
*(Press `Ctrl + C` in the terminal when you are done viewing it to stop the server).*
