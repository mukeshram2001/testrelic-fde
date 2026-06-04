/**
 * TestRelic Cloud Uploader
 * Uploads intelligence reports using the proven SDK run flow:
 *   /sdk/auth/token → /repos/resolve → /runs/init → /runs/:id/tests → /runs/:id/finalize
 *
 * All field names verified live against the platform API (June 2026).
 * The /ingest (CTRF) route is not used — it returns 401 at the gateway level.
 * This flow uses the identical endpoints the Playwright Analytics SDK uses successfully.
 */

import { IntelligenceReport } from './types.js';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

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
    // Step 1: Exchange API key for JWT (same as Playwright SDK)
    const token = await this.exchangeToken();

    // Step 2: Auto-detect git remote and resolve repo ID on the platform
    const repoGitId = await this.resolveRepoGitId();
    const repoId = await this.resolveRepo(token, repoGitId);

    // Step 3: Open a new run session (client generates runId)
    const runId = await this.initRun(token, repoId, repoGitId, report);

    // Step 4: Stream test cases into the run
    await this.uploadTests(token, runId, report);

    // Step 5: Close and finalize the run
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
  // Field name confirmed: 'gitId' (not 'repoGitId')
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
  // Client generates runId (UUID) and sends it — platform returns it back with status
  private async initRun(
    token: string,
    repoId: string,
    repoGitId: string,
    report: IntelligenceReport,
  ): Promise<string> {
    const runId = randomUUID();
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
          source: 'smart-reporter',
          projectName: this.projectName,
          healthScore: report.healthScore.overall,
          totalTests: report.summary.totalTests,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Run init failed (${res.status}): ${await res.text()}`);
    }
    return runId;
  }

  // ── Step 4: Upload test cases ─────────────────────────────────────────────
  // A single top-level testId is required alongside the tests array.
  private async uploadTests(
    token: string,
    runId: string,
    report: IntelligenceReport,
  ): Promise<void> {
    const tests = [];
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
        testId: randomUUID(), // top-level testId required by the platform
        tests,
      }),
    });
    if (!res.ok) {
      throw new Error(`Test upload failed (${res.status}): ${await res.text()}`);
    }
  }

  // ── Step 5: Finalize run ──────────────────────────────────────────────────
  // 'duration' (ms) is a required field alongside finishedAt and summary
  private async finalizeRun(
    token: string,
    runId: string,
    report: IntelligenceReport,
  ): Promise<void> {
    const startMs = new Date(report.run.timestamp).getTime();
    const durationMs = Math.round(report.summary.duration * 1000);
    const finishMs = startMs + durationMs;

    const res = await fetch(`${this.baseUrl}/runs/${runId}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        finishedAt: new Date(finishMs).toISOString(),
        duration: durationMs,
        summary: {
          total: report.summary.totalTests,
          passed: report.summary.passed,
          failed: report.summary.failed,
          skipped: report.summary.skipped,
          flaky: report.flakyTests.length,
          healthScore: report.healthScore.overall,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Run finalize failed (${res.status}): ${await res.text()}`);
    }
  }
}

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
