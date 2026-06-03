# Scale Brief: The 10,000-Customer Question

---

## Deployment Playbook: Onboarding 50 Customers

### The Sequence: Signup to First Insight

| Step | Action | Time | Drop-off Risk | Mitigation |
|------|--------|------|---------------|------------|
| 1 | Sign up at platform.testrelic.ai | 1 min | Low — email auth | GitHub OAuth for one-click |
| 2 | Create project, copy API key | 1 min | Low | CLI wizard auto-creates project |
| 3 | `npm install @testrelic/playwright-analytics` | 30 sec | Low | One-liner in docs, copy-paste ready |
| 4 | Add reporter to `playwright.config.ts` | 2 min | **Medium** — config syntax errors | Interactive config generator; validates before saving |
| 5 | Run tests locally to verify | 2 min | **High** — first run fails silently | `smart-reporter doctor` command validates setup; verbose error messages |
| 6 | See first report in dashboard | 1 min | Low | Auto-refresh; celebratory empty-state design |
| 7 | Set up GitHub Action for CI upload | 3 min | **High** — YAML editing intimidation | Pre-built action: `uses: testrelic/action@v1` with 2 params |
| 8 | Receive first Slack alert on failure | 5 min | Medium — webhook setup | One-click Slack OAuth in dashboard |
| 9 | Use AI insight to fix first real bug | Variable | Medium | In-product tutorial; "Good First Insight" highlighting |

**Critical insight:** Steps 4, 5, and 7 are where customers die. We need guardrails at each: validation, clear errors, and fallback paths.

### Drop-off Mitigation Strategy

- **Step 4 (Config):** Build a `npx @testrelic/setup` wizard that detects their Playwright version, patches the config file automatically, and validates the syntax.
- **Step 5 (First Run):** The `doctor` command checks: API key validity, XML output directory exists, Playwright reporter is wired correctly, network connectivity to TestRelic API.
- **Step 7 (CI):** Provide a verified GitHub Action with intelligent defaults. Don't make users write YAML.

---

## Top 3 Integration Failure Patterns

### Failure #1: Silent Upload Drops

**Symptom:** "My tests run but I don't see anything in the dashboard."  
**Root Cause:** `TESTRELIC_API_KEY` is unset, malformed, or the reporter swallows the error and falls back to no-op silently.  
**Customer Sees:** Nothing — the dashboard stays empty. They assume the product is broken.  
**Resolution:**
1. Run `npx smart-reporter doctor` — validates API key by making a test request
2. Check that `TESTRELIC_API_KEY` is set in environment (not hardcoded): `echo $TESTRELIC_API_KEY`
3. If using GitHub Actions, verify the secret is set in repository settings and referenced in the workflow

**Prevention:** The SDK should never fail silently. Every upload attempt should produce a visible log line: `[testrelic] Upload succeeded: 12 tests` or `[testrelic] Upload failed: Invalid API key — check TESTRELIC_API_KEY at platform.testrelic.ai/settings`.

### Failure #2: JUnit XML Path Mismatch

**Symptom:** "I get 'Input file not found' when running the reporter."  
**Root Cause:** Playwright's JUnit reporter outputs to a different path than the default the CLI expects. Custom `outputFile` configs in `playwright.config.ts` break the default.  
**Customer Sees:** `Error: Input file not found: test-results/junit-report.xml`  
**Resolution:**
1. Check where Playwright writes JUnit output: look for `reporter: [['junit', { outputFile: '...' }]]` in config
2. Pass the correct path: `npx smart-reporter analyze --input ./actual/path/results.xml`
3. Or use glob mode: `npx smart-reporter analyze --input "test-results/**/*.xml"`

**Prevention:** Auto-discovery — the CLI should scan common output directories (`test-results/`, `playwright-report/`, `.`) for XML files and prompt the user if multiple are found.

### Failure #3: CI Environment Detection Failure

**Symptom:** "Tests uploaded but they're tagged as 'local' when they ran in CI."  
**Root Cause:** The SDK uses heuristics to detect CI environment (GITHUB_ACTIONS env var, etc.). Self-hosted runners, Docker containers, or non-standard CI systems break this.  
**Customer Sees:** Dashboard shows "Environment: local" for CI runs; can't filter by CI branch or correlate with PRs.  
**Resolution:**
1. Explicitly set CI metadata in reporter config: `environment: 'ci'`, `branch: process.env.GITHUB_REF`
2. Or use the `ci` config block in `playwright.config.ts` to manually specify provider, run URL, and branch
3. Verify in dashboard that environment tag shows correctly after next run

**Prevention:** Support the `CI` universal env var as a fallback. When `CI=true` but provider is unknown, prompt for manual configuration rather than defaulting to "local".

---

## Feedback Loop Design

### Events to Track

| Event | Purpose | Activation Signal |
|-------|---------|-------------------|
| `sdk.reporter.configured` | Onboarding progress | — |
| `sdk.upload.success` / `sdk.upload.failure` | Integration health | — |
| `dashboard.report.viewed` | Engagement — are they looking? | ≥3 views in first week |
| `dashboard.failure.insight.clicked` | Value moment — did AI help? | 1 insight clicked |
| `dashboard.test.muted` | Flaky test workflow adopted | 1 mute action |
| `alert.slack.received` | Notification channel working | Slack webhook configured |
| `mcp.query.executed` | Power user behavior | 1 MCP query |

### Activation Definition

A team is **activated** when they complete the **"First Insight Loop"** within 14 days:
1. Upload ≥3 test runs
2. View ≥1 failure insight
3. Have a subsequent run where that test passes (implying they fixed it)

**Target:** 60% activation rate within 14 days of signup.

### Instrumentation Implementation

- **SDK-side:** Lightweight event queue, flushed after test run. No blocking, no PII. Events: reporter version, upload success/failure, file size.
- **Dashboard-side:** Page views, feature clicks, time-to-first-insight. Standard product analytics.
- **MCP-side:** Query count, response ratings (thumbs up/down), most common query types.
- **Alert-side:** Notification delivery confirmations, click-through rates on failure links.

---

## Product Insight: One Feature Request

### Problem

During this assignment, the biggest friction point was the **cold-start problem for flakiness detection**. The AI can only confidently identify flaky tests after multiple runs — but a new customer has zero history. This creates a frustrating first week where the tool says "insufficient data" for every flakiness query, making the customer wonder if the AI actually works.

### Proposed Solution: **Community Baseline Flakiness Model**

TestRelic should build an anonymized, aggregated flakiness model across all projects using similar testing patterns. When a new customer uploads their first run, the AI can immediately flag tests that are *historically flaky across the ecosystem* — e.g., "tests matching `*.waitForNavigation*` have a 34% flaky rate across 1,200 projects." This gives the customer value on day one, not day fourteen.

### Evidence

- In my own test suite, flakiness detection required 3+ runs before any confidence could be assigned. The first two runs produced "insufficient data" responses — exactly the moment when a new customer is deciding whether the tool is worth keeping.
- The failure classifier I built categorizes errors into 5 types (Assertion, Timeout, Selector, Network, Unknown). Timeout and Selector errors are the most common flakiness sources across all projects. A shared model predicting "this test has a selector-based failure → 40% chance of flakiness" would be immediately useful.
- Competitors (Chromatic, Currents) charge premium for flakiness detection because it requires historical data. A community model would be a differentiated moat.

### Implementation Sketch

```
Phase 1 (MVP): Manual curation — maintain a JSON file of common flaky patterns
                (selectors, timeouts, race conditions) with baseline probabilities.

Phase 2: Automated aggregation — anonymized extraction of 
         (pattern_type, flakiness_rate) tuples from opted-in projects.

Phase 3: Per-framework models — Playwright, Cypress, Jest each get 
         specialized models trained on their specific failure modes.
```

**Impact:** Reduces time-to-first-value from ~1 week to ~5 minutes. Converts "insufficient data" (disappointment) into "baseline risk score" (actionable insight).
