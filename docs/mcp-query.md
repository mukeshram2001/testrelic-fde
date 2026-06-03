# MCP Server Query Documentation

## Configuration

The TestRelic MCP Server was configured in Claude Desktop with the following settings:

```json
{
  "mcpServers": {
    "testrelic": {
      "command": "npx",
      "args": ["-y", "@testrelic/mcp-server@latest"],
      "env": {
        "TESTRELIC_API_KEY": "tr_api_xxxxxxxxxxxxxxxx",
        "TESTRELIC_PROJECT": "fde-assignment-smart-reporter"
      }
    }
  }
}
```

## Query 1: Flaky Test Detection

**Prompt:**
```
Which of my tests are most likely to be flaky based on the last 3 runs?
```

**AI Response:**
Based on your test history for project `fde-assignment-smart-reporter`, here's the flakiness analysis:

| Test | Pass Rate | Confidence | Primary Failure | Risk Level |
|------|-----------|------------|-----------------|------------|
| `auth-empty-submission-shows-validation-errors` | 0% (0/3) | High | AssertionError — expected error element visible, got hidden | 🔴 Critical |
| `authentication-failed-login` | 100% (3/3) | Low | — | 🟢 Stable |
| `task-management-create-new-task` | 100% (3/3) | Low | — | 🟢 Stable |

**Insight:** The `auth-empty-submission` test has failed consistently with the same AssertionError pattern. This isn't flakiness — it's a deterministic failure. The test expects an error message to appear when submitting an empty form, but the application uses HTML5 `required` attribute validation which prevents form submission entirely. Consider updating the test to verify the HTML5 validation behavior or adjust the application to show a custom error.

**Actionable Next Step:** Update the test to check for HTML5 validation using `page.evaluate(() => document.querySelector('input').validationMessage)` instead of expecting a visible error element.

---

## Query 2: Failure Pattern Analysis

**Prompt:**
```
What's the most common failure pattern in my test suite and how should I fix it?
```

**AI Response:**
Analyzing your recent test runs, I found **1 primary failure pattern**:

**Pattern:** `AssertionError — Expected visible, element was hidden`
- **Occurrences:** 3/3 runs
- **Affected test:** `auth-empty-submission-shows-validation-errors`
- **Category:** Test-Application Mismatch

**Root Cause:** The test assumes client-side JavaScript validation (showing an error div), but the demo app uses native HTML5 form validation (`required` attribute) which blocks submission at the browser level before JavaScript runs.

**Recommended Fix:**
```typescript
// Instead of:
await expect(errorMessage).toBeVisible();

// Use:
const isFormValid = await page.evaluate(() => {
  const input = document.querySelector('#email');
  return (input as HTMLInputElement).checkValidity();
});
expect(isFormValid).toBe(false);
```

**Impact:** Fixing this will bring your pass rate from 83.3% to 100% and improve your health score from 71 to 92.

---

## Query 3: Test Health Overview

**Prompt:**
```
Give me a summary of my test suite health over the past week.
```

**AI Response:**
## 📊 Test Suite Health: 71/100 (Stable)

**Current Run (Latest):**
- Pass Rate: 83.3% (5/6 passed)
- Duration: 12.4s
- Failures: 1 (consistent, not flaky)

**Trend:** Stable — the same test has been failing deterministically across all runs. No new failures introduced.

**Strengths:**
- Auth flow tests are solid (100% pass rate)
- Task CRUD operations work reliably
- Test execution speed is good (<15s total)

**Risk Areas:**
- 1 test with consistent failure pattern
- No flaky tests detected (good)
- Coverage focused on happy paths — consider adding edge case tests

**Recommendation:** Address the auth-empty-submission test to reach 100% pass rate. Then consider adding tests for network failure handling and slow connection simulation.

---

## Assessment of MCP Insights

| Query | Actionable? | Accuracy | Non-Obvious Insight? |
|-------|-------------|----------|---------------------|
| Flaky detection | ✅ Yes | ✅ Correctly identified deterministic vs flaky | ✅ Explained WHY it's not flaky |
| Failure pattern | ✅ Yes | ✅ Correct root cause analysis | ✅ Suggested code fix |
| Health overview | ✅ Yes | ✅ Accurate summary | ✅ Specific improvement target |

**Verdict:** The MCP Server delivers genuinely useful insights. The flakiness distinction (deterministic failure vs true flakiness) is particularly valuable — it prevents the user from chasing randomness when the problem is actually predictable. The suggested code fix is syntactically correct and addresses the root cause.

**One Suggestion:** Adding a "confidence interval" to predictions would help users calibrate their trust — e.g., "83% confident this is a test-app mismatch, 12% confident it's a timing issue."
