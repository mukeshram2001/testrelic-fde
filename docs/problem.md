# Problem Decomposition

## Customer Profile
12-person SaaS startup, no dedicated QA. Developers own testing. Playwright tests exist but reports are invisible — buried as XML artifacts in GitHub Actions. Production failures discovered via Slack, not tests.

---

## Root Cause Analysis

The customer believes they need "better test reports" — but the real problem is that **test results are invisible to the people who can act on them**. XML artifacts in CI are a write-only medium: information goes in, nothing comes out. The team's feedback loop is broken not at the reporting layer, but at the *attention* layer. Nobody reads reports because the activation energy is too high (download artifact → parse XML → correlate with code → decide action) and there's no push mechanism that surfaces signal over noise. The Slack-first failure discovery pattern reveals that the team has already implicitly given up on tests as a source of truth — they've routed around the problem rather than solving it.

---

## Jobs-to-be-Done

### Functional Jobs

1. **"When CI finishes running, I want to know if my change broke something important, so I can fix it before merging — without reading XML."**

2. **"When a test fails, I want to understand what happened in plain language, so I can decide in 30 seconds whether it's a real bug, a flaky test, or a test that needs updating."**

3. **"When I'm prioritizing work, I want to know which tests are actually catching real bugs vs. creating noise, so I can invest my limited time in tests that matter."**

### Emotional Job

4. **"When I ship code, I want to feel confident that my tests have my back — not wonder if they're even telling me the truth."**

---

## Failure Modes at Scale (200 Teams)

### 1. The "Integrate and Ignore" Trap
**Symptom:** Teams install the tool, see one report, then gradually stop looking. Dashboards become graveyards of stale data.  
**Prevention:** Build activation into the workflow — Slack/Teams notifications on failure, GitHub PR comments with inline insights, block-merge policies that reference test health. The tool must *interrupt* the developer at the moment of decision, not sit passively waiting to be visited.

### 2. Flaky Test Desensitization
**Symptom:** As more teams use the tool, flaky test noise scales linearly. Developers learn to ignore failures, defeating the purpose. The AI crying "wolf" erodes trust.  
**Prevention:** Implement flaky test detection with confidence scoring (not binary flags). Only surface high-confidence flakiness. For borderline cases, collect more data before alerting. Provide a one-click "mute for now" with automatic retry scheduling.

### 3. The "Works on My Machine" Onboarding Cliff
**Symptom:** Teams abandon setup at the first error — SDK key not found, CI environment variables missing, XML path wrong. Each confused team costs support time and creates negative word-of-mouth.  
**Prevention:** Zero-config detection (auto-find common XML paths), detailed error messages that suggest the exact fix, a `doctor` command that validates setup, and fallback to local-only mode that works without API keys. The first report must appear within 2 commands of install.

---

## Success Metric

**Signal:** Mean Time to First Fix (MTFF) — the time from test failure to developer commit that fixes the root cause.  

**How TestRelic surfaces it:** Track when a failure insight is viewed → when the corresponding test passes in the next run → calculate the delta. A declining MTFF curve means the tool is genuinely accelerating the team's response. Target: MTFF < 15 minutes for 80% of failures within 30 days of adoption.  

**Activation threshold:** A team is "activated" when they view 3 failure insights that lead to fixes within one sprint cycle.
