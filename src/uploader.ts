/**
 * TestRelic Cloud Uploader
 * Uploads intelligence reports to the TestRelic platform via CTRF-compatible REST API
 * Enables dashboard visualization and AI-powered insights
 */

import { IntelligenceReport } from './types.js';
import fetch from 'node-fetch';

interface UploaderOptions {
  apiKey: string;
  projectName: string;
  baseUrl?: string;
}

interface CTRFReport {
  results: {
    tool: { name: string; version: string };
    summary: {
      tests: number;
      passed: number;
      failed: number;
      skipped: number;
      pending: number;
      other: number;
      start: number;
      stop: number;
      suites: number;
    };
    tests: CTRFTest[];
    environment?: Record<string, string>;
  };
}

interface CTRFTest {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'other';
  duration: number;
  start: number;
  stop: number;
  suite?: string;
  message?: string;
  trace?: string;
  rawStatus?: string;
  type?: string;
  filepath?: string;
  retries?: number;
  flaky?: boolean;
  browser?: string;
  extra?: Record<string, unknown>;
}

export class TestRelicUploader {
  private apiKey: string;
  private projectName: string;
  private baseUrl: string;

  constructor(options: UploaderOptions) {
    this.apiKey = options.apiKey;
    this.projectName = options.projectName;
    this.baseUrl = options.baseUrl || 'https://api.testrelic.ai/v1';
  }

  async upload(report: IntelligenceReport): Promise<{ id: string; url: string }> {
    const ctrf = this.toCTRF(report);

    const response = await fetch(`${this.baseUrl}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Project-Name': this.projectName,
      },
      body: JSON.stringify(ctrf),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed (${response.status}): ${error}`);
    }

    const result = await response.json() as { id: string; url: string };
    return result;
  }

  private toCTRF(report: IntelligenceReport): CTRFReport {
    const tests: CTRFTest[] = [];

    for (const suite of report.run.testSuites) {
      for (const tc of suite.testCases) {
        const startTime = new Date(report.run.timestamp).getTime();
        tests.push({
          name: tc.name,
          status: tc.status === 'error' ? 'failed' : tc.status,
          duration: Math.round(tc.time * 1000), // Convert to ms
          start: startTime,
          stop: startTime + Math.round(tc.time * 1000),
          suite: suite.name,
          message: tc.failure?.message,
          trace: tc.failure?.stackTrace,
          flaky: tc.flaky || report.flakyTests.some(f => f.name === tc.name),
          extra: {
            classname: tc.classname,
            failureType: tc.failure ? categorizeFailure(tc.failure.message, tc.failure.type) : undefined,
          },
        });
      }
    }

    return {
      results: {
        tool: { name: 'testrelic-smart-reporter', version: '1.0.0' },
        summary: {
          tests: report.summary.totalTests,
          passed: report.summary.passed,
          failed: report.summary.failed,
          skipped: report.summary.skipped,
          pending: 0,
          other: 0,
          start: new Date(report.run.timestamp).getTime(),
          stop: new Date(report.run.timestamp).getTime() + Math.round(report.summary.duration * 1000),
          suites: report.run.testSuites.length,
        },
        tests,
        environment: {
          reporter: 'smart-reporter',
          healthScore: String(report.healthScore.overall),
          trend: report.healthScore.trend,
        },
      },
    };
  }
}

function categorizeFailure(message: string, type?: string): string {
  const lower = (message || '').toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out')) return 'TimeoutError';
  if (lower.includes('selector') || lower.includes('locator') || lower.includes('element not found')) return 'SelectorError';
  if (lower.includes('assert') || lower.includes('expect') || lower.includes('to be')) return 'AssertionError';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) return 'NetworkError';
  return type || 'UnknownError';
}
