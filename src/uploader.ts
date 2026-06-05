/**
 * TestRelic Cloud Uploader — Full Intelligence Upload
 *
 * Upload flow (identical endpoints as Playwright Analytics SDK):
 *   /sdk/auth/token → /repos/resolve → /runs/init → /runs/:id/tests → /runs/:id/finalize
 *
 * UPGRADED: Now uploads the COMPLETE IntelligenceReport including:
 *   - narrative (plain-English run summary)
 *   - executiveSummary (markdown table)
 *   - actionItems (prioritized fix recommendations)
 *   - topFailures (classified failure patterns with recommendations)
 *   - flakyTests (with confidence scores)
 *   - slowTests (top 5 slowest tests)
 *   - healthScore (all sub-scores: stability, speed, coverage, trend)
 *
 * Backwards-compatible: all new intelligence fields go under
 * metadata.intelligence so the platform ignores unknown keys gracefully.
 *
 * All field names verified live against the platform API (June 2026).
 */

import { IntelligenceReport, FailurePattern, FlakyTest, ActionItem, TestCase } from './types.js';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Upload schema interfaces (what we send to the cloud)
// ─────────────────────────────────────────────────────────────────────────────

/** Uploaded per-test record — same as before + failureType in metadata */
interface UploadTestRecord {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;                 // milliseconds
  startedAt: string;
  finishedAt: string;
  suite: string;
  errorMessage?: string;
  errorStack?: string;
  flaky: boolean;
  metadata: {
    classname: string;
    failureType?: string;           // 'AssertionError' | 'TimeoutError' | ...
  };
}

/** Full intelligence block — new, sent under metadata.intelligence */
interface IntelligenceBlock {
  narrative: string;                // plain-English paragraph
  executiveSummary: string;         // markdown table string
  actionItems: UploadActionItem[];
  topFailures: UploadFailurePattern[];
  flakyTests: UploadFlakyTest[];
  slowTests: UploadSlowTest[];
  healthScore: UploadHealthScore;
}

interface UploadHealthScore {
  overall: number;
  stability: number;
  speed: number;
  coverage: number;
  trend: string;
  summary: string;
}

interface UploadFailurePattern {
  type: string;
  category: string;
  count: number;
  examples: string[];
  recommendation: string;
}

interface UploadFlakyTest {
  name: string;
  classname: string;
  totalRuns: number;
  passRate: number;
  confidence: string;
  failureTypes: string[];
}

interface UploadActionItem {
  priority: string;
  title: string;
  description: string;
  affectedTests: string[];
  suggestion: string;
}

interface UploadSlowTest {
  name: string;
  classname: string;
  durationMs: number;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Uploader class
// ─────────────────────────────────────────────────────────────────────────────

interface UploaderOptions {
  apiKey: string;
  projectName: string;
  baseUrl?: string;
}

export class TestRelicUploader {
  private apiKey: string;
  private projectName: string;
  private baseUrl: string;

  constructor(options: UploaderOptions) {
    this.apiKey = options.apiKey;
    this.projectName = options.projectName;
    this.baseUrl =
      options.baseUrl ||
      process.env.TESTRELIC_CLOUD_ENDPOINT ||
      'https://platform.testrelic.ai/api/v1';
  }

  async upload(report: IntelligenceReport): Promise<{ id: string; url: string }> {
    // Step 1: Exchange API key for JWT
    const token = await this.exchangeToken();

    // Step 2: Resolve repo from git remote
    const repoGitId = await this.resolveRepoGitId();
    const repoId = await this.resolveRepo(token, repoGitId);

    // Step 3: Open a new run session with full intelligence metadata
    const runId = await this.initRun(token, repoId, repoGitId, report);

    // Step 4: Stream test cases (with failure categories + flaky flags)
    await this.uploadTests(token, runId, report);

    // Step 5: Finalize with summary + complete intelligence block
    await this.finalizeRun(token, runId, report);

    const url = `https://platform.testrelic.ai/repos/${repoId}/runs/${runId}`;
    return { id: runId, url };
  }

  // ── Step 1: Token Exchange ────────────────────────────────────────────────
  private async exchangeToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/sdk/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
    });
    if (!res.ok) {
      throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { accessToken: string };
    if (!data.accessToken) throw new Error('No access token in auth response');
    return data.accessToken;
  }

  // ── Step 2a: Read git remote URL ──────────────────────────────────────────
  private async resolveRepoGitId(): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      return remote;
    } catch {
      return `https://github.com/${this.projectName}`;
    }
  }

  // ── Step 2b: Resolve repo on platform ─────────────────────────────────────
  private async resolveRepo(token: string, repoGitId: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/repos/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ gitId: repoGitId }),
    });
    if (!res.ok) {
      throw new Error(`Repo resolve failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { repoId: string };
    if (!data.repoId) throw new Error('No repoId in resolve response');
    return data.repoId;
  }

  // ── Step 3: Initialize run ─────────────────────────────────────────────────
  //
  // UPGRADED: metadata now contains the FULL intelligence block including
  // narrative, executiveSummary, actionItems, topFailures, flakyTests, slowTests.
  // All new fields are nested under metadata.intelligence for backwards compatibility.
  //
  // BEFORE:
  //   metadata: { source, projectName, healthScore, totalTests }
  //
  // AFTER:
  //   metadata: {
  //     source, projectName, healthScore, totalTests,
  //     intelligence: { narrative, executiveSummary, actionItems,
  //                     topFailures, flakyTests, slowTests, healthScore }
  //   }
  private async initRun(
    token: string,
    repoId: string,
    repoGitId: string,
    report: IntelligenceReport,
  ): Promise<string> {
    const runId = randomUUID();

    const intelligence = this.buildIntelligenceBlock(report);

    const res = await fetch(`${this.baseUrl}/runs/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        runId,
        repoId,
        repoGitId,
        startedAt: new Date(report.run.timestamp).toISOString(),
        metadata: {
          // ── existing fields (unchanged) ──────────────────────────────────
          source: 'smart-reporter',
          projectName: this.projectName,
          healthScore: report.healthScore.overall,
          totalTests: report.summary.totalTests,
          // ── NEW: full intelligence block ─────────────────────────────────
          intelligence,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Run init failed (${res.status}): ${await res.text()}`);
    }
    return runId;
  }

  // ── Step 4: Upload test cases ─────────────────────────────────────────────
  //
  // UNCHANGED from original — per-test records with failure types and flaky flags.
  private async uploadTests(
    token: string,
    runId: string,
    report: IntelligenceReport,
  ): Promise<void> {
    const tests: UploadTestRecord[] = [];
    const baseTime = new Date(report.run.timestamp).getTime();

    for (const suite of report.run.testSuites) {
      for (const tc of suite.testCases) {
        const durationMs = Math.round(tc.time * 1000);
        tests.push({
          testId: randomUUID(),
          name: tc.name,
          status: tc.status === 'error' ? 'failed' : tc.status,
          duration: durationMs,
          startedAt: new Date(baseTime).toISOString(),
          finishedAt: new Date(baseTime + durationMs).toISOString(),
          suite: suite.name,
          errorMessage: tc.failure?.message,
          errorStack: tc.failure?.stackTrace,
          flaky: tc.flaky || report.flakyTests.some((f) => f.name === tc.name),
          metadata: {
            classname: tc.classname,
            failureType: tc.failure
              ? categorizeFailure(tc.failure.message, tc.failure.type)
              : undefined,
          },
        });
      }
    }

    const res = await fetch(`${this.baseUrl}/runs/${runId}/tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        testId: randomUUID(),
        tests,
      }),
    });
    if (!res.ok) {
      throw new Error(`Test upload failed (${res.status}): ${await res.text()}`);
    }
  }

  // ── Step 5: Finalize run ──────────────────────────────────────────────────
  //
  // UPGRADED: summary now contains the full intelligence block as well.
  //
  // BEFORE:
  //   { finishedAt, duration, summary: { total, passed, failed, skipped, flaky, healthScore } }
  //
  // AFTER:
  //   { finishedAt, duration,
  //     summary: { total, passed, failed, skipped, flaky, healthScore },
  //     intelligence: { narrative, executiveSummary, actionItems,
  //                     topFailures, flakyTests, slowTests, healthScore } }
  private async finalizeRun(
    token: string,
    runId: string,
    report: IntelligenceReport,
  ): Promise<void> {
    const startMs = new Date(report.run.timestamp).getTime();
    const durationMs = Math.round(report.summary.duration * 1000);
    const finishMs = startMs + durationMs;

    const intelligence = this.buildIntelligenceBlock(report);

    const res = await fetch(`${this.baseUrl}/runs/${runId}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        finishedAt: new Date(finishMs).toISOString(),
        duration: durationMs,
        // ── existing summary (unchanged) ─────────────────────────────────────
        summary: {
          total: report.summary.totalTests,
          passed: report.summary.passed,
          failed: report.summary.failed,
          skipped: report.summary.skipped,
          flaky: report.flakyTests.length,
          healthScore: report.healthScore.overall,
        },
        // ── NEW: full intelligence block ──────────────────────────────────────
        intelligence,
      }),
    });
    if (!res.ok) {
      throw new Error(`Run finalize failed (${res.status}): ${await res.text()}`);
    }
  }

  // ── Intelligence Block Builder ────────────────────────────────────────────
  //
  // Builds the complete IntelligenceBlock from the IntelligenceReport.
  // This is the new data that was previously only written to local files.
  //
  // Includes:
  //   narrative          ← plain-English run summary paragraph
  //   executiveSummary   ← markdown table with pass rate, stability, actions
  //   actionItems        ← prioritized list of fix recommendations
  //   topFailures        ← classified failure patterns with counts & recommendations
  //   flakyTests         ← flaky test list with pass rates and confidence scores
  //   slowTests          ← top 5 slowest test names and durations
  //   healthScore        ← full score object (overall, stability, speed, coverage, trend)
  private buildIntelligenceBlock(report: IntelligenceReport): IntelligenceBlock {
    const actionItems: UploadActionItem[] = report.actionItems.map((a: ActionItem) => ({
      priority: a.priority,
      title: a.title,
      description: a.description,
      affectedTests: a.affectedTests,
      suggestion: a.suggestion,
    }));

    const topFailures: UploadFailurePattern[] = report.topFailures.map((f: FailurePattern) => ({
      type: f.type,
      category: f.category,
      count: f.count,
      examples: f.examples,
      recommendation: f.recommendation,
    }));

    const flakyTests: UploadFlakyTest[] = report.flakyTests.map((f: FlakyTest) => ({
      name: f.name,
      classname: f.classname,
      totalRuns: f.totalRuns,
      passRate: f.passRate,
      confidence: f.confidence,
      failureTypes: f.failureTypes,
    }));

    const slowTests: UploadSlowTest[] = report.slowTests.map((t: TestCase) => ({
      name: t.name,
      classname: t.classname,
      durationMs: Math.round(t.time * 1000),
      status: t.status,
    }));

    const healthScore: UploadHealthScore = {
      overall: report.healthScore.overall,
      stability: report.healthScore.stability,
      speed: report.healthScore.speed,
      coverage: report.healthScore.coverage,
      trend: report.healthScore.trend,
      summary: report.healthScore.summary,
    };

    return {
      narrative: report.narrative,
      executiveSummary: report.executiveSummary,
      actionItems,
      topFailures,
      flakyTests,
      slowTests,
      healthScore,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal failure categorizer (same logic as classifier.ts — duplicated here
// to avoid a circular import with types.ts)
// ─────────────────────────────────────────────────────────────────────────────
function categorizeFailure(message: string, type?: string): string {
  const lower = (message || '').toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out')) return 'TimeoutError';
  if (lower.includes('selector') || lower.includes('locator') || lower.includes('element not found'))
    return 'SelectorError';
  if (lower.includes('assert') || lower.includes('expect') || lower.includes('to be'))
    return 'AssertionError';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection'))
    return 'NetworkError';
  return type || 'UnknownError';
}
