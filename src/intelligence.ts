/**
 * Test Intelligence Engine
 * Analyzes parsed test results and generates actionable insights
 * This is the "brain" of the Smart Reporter — it transforms raw data into human-understandable intelligence
 */

import {
  TestRun, TestCase, FailurePattern, FlakyTest, HealthScore,
  ActionItem, IntelligenceReport, TestSuite
} from './types.js';
import { estimateFlakiness, categorizeFailure, extractErrorContext } from './classifier.js';

export class IntelligenceEngine {
  private run: TestRun;
  private historicalRuns: TestRun[];

  constructor(run: TestRun, historicalRuns: TestRun[] = []) {
    this.run = run;
    this.historicalRuns = historicalRuns;
  }

  generateReport(): IntelligenceReport {
    const summary = this.computeSummary();
    const healthScore = this.computeHealthScore();
    const topFailures = this.identifyFailurePatterns();
    const flakyTests = this.identifyFlakyTests();
    const slowTests = this.identifySlowTests();
    const actionItems = this.generateActionItems(topFailures, flakyTests, slowTests, healthScore);
    const narrative = this.generateNarrative(summary, healthScore, topFailures, flakyTests);
    const executiveSummary = this.generateExecutiveSummary(summary, healthScore, actionItems);

    return {
      run: this.run,
      generatedAt: new Date().toISOString(),
      summary,
      healthScore,
      topFailures,
      flakyTests,
      slowTests,
      actionItems,
      narrative,
      executiveSummary,
    };
  }

  private computeSummary() {
    const allTests = this.allTestCases();
    const passed = allTests.filter(t => t.status === 'passed').length;
    const failed = allTests.filter(t => t.status === 'failed' || t.status === 'error').length;
    const skipped = allTests.filter(t => t.status === 'skipped').length;

    return {
      totalTests: allTests.length,
      passed,
      failed,
      skipped,
      duration: this.run.time,
      passRate: allTests.length > 0 ? Math.round((passed / allTests.length) * 1000) / 10 : 0,
    };
  }

  private computeHealthScore(): HealthScore {
    const allTests = this.allTestCases();
    const summary = this.computeSummary();

    // Stability: based on pass rate and failure severity
    const passRate = summary.passRate / 100;
    const hasCriticalFailures = allTests.some(t => 
      t.status === 'failed' && t.failure?.type?.includes('Assertion')
    );
    const stability = Math.round((passRate * (hasCriticalFailures ? 70 : 100)));

    // Speed: based on average test duration (target: <2s per test)
    const avgDuration = summary.totalTests > 0 ? summary.duration / summary.totalTests : 0;
    const speedScore = avgDuration < 1 ? 100 : avgDuration < 2 ? 85 : avgDuration < 5 ? 60 : 40;

    // Coverage proxy: test count relative to project size heuristic
    const coverageScore = summary.totalTests >= 20 ? 90 : summary.totalTests >= 10 ? 75 : summary.totalTests >= 5 ? 60 : 40;

    const overall = Math.round((stability * 0.5) + (speedScore * 0.25) + (coverageScore * 0.25));

    let trend: HealthScore['trend'] = 'stable';
    if (this.historicalRuns.length >= 2) {
      const prevPassRate = this.computePassRate(this.historicalRuns[this.historicalRuns.length - 1]);
      const currPassRate = summary.passRate;
      if (currPassRate > prevPassRate + 5) trend = 'improving';
      else if (currPassRate < prevPassRate - 5) trend = 'degrading';
    }

    const summaries = [
      overall >= 90 ? 'Excellent test health — suite is stable and fast.' :
      overall >= 75 ? 'Good overall health with minor areas to improve.' :
      overall >= 60 ? 'Fair health — some issues need attention soon.' :
      overall >= 40 ? 'Poor health — failures are impacting team velocity.' :
      'Critical — immediate action required to restore test reliability.',
    ];

    if (stability < 60) summaries.push(' Test stability is the primary concern.');
    if (speedScore < 60) summaries.push(' Slow tests are dragging down CI pipeline speed.');

    return {
      overall: Math.max(0, Math.min(100, overall)),
      stability: Math.max(0, Math.min(100, stability)),
      speed: Math.max(0, Math.min(100, speedScore)),
      coverage: Math.max(0, Math.min(100, coverageScore)),
      trend,
      summary: summaries.join(''),
    };
  }

  private identifyFailurePatterns(): FailurePattern[] {
    const failedTests = this.allTestCases().filter(t => t.status === 'failed' || t.status === 'error');
    const patterns = new Map<string, FailurePattern>();

    for (const test of failedTests) {
      if (!test.failure) continue;
      const category = categorizeFailure(test.failure.message, test.failure.type);
      const key = `${category}|${test.failure.type}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          type: test.failure.type || 'UnknownError',
          category,
          count: 0,
          examples: [],
          recommendation: this.generateRecommendation(category, test),
        });
      }

      const pattern = patterns.get(key)!;
      pattern.count++;
      if (pattern.examples.length < 3) {
        const context = extractErrorContext(test.failure.message, test.failure.stackTrace);
        if (context && !pattern.examples.includes(context)) {
          pattern.examples.push(context);
        }
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private identifyFlakyTests(): FlakyTest[] {
    if (this.historicalRuns.length < 2) {
      // Without history, estimate flakiness from failure patterns in current run
      const currentFailures = this.allTestCases().filter(t => t.status === 'failed' || t.status === 'error');
      return currentFailures.slice(0, 3).map(t => ({
        name: t.name,
        classname: t.classname,
        totalRuns: 1,
        passRate: 0,
        confidence: 'low' as const,
        failureTypes: t.failure ? [categorizeFailure(t.failure.message, t.failure.type)] : ['UnknownError'],
      }));
    }

    const testHistory = new Map<string, { passes: number; total: number; failures: string[] }>();

    for (const run of [...this.historicalRuns, this.run]) {
      for (const test of this.allTestCasesFromRun(run)) {
        const key = `${test.classname}.${test.name}`;
        if (!testHistory.has(key)) {
          testHistory.set(key, { passes: 0, total: 0, failures: [] });
        }
        const h = testHistory.get(key)!;
        h.total++;
        if (test.status === 'passed') h.passes++;
        else if (test.failure) h.failures.push(categorizeFailure(test.failure.message, test.failure.type));
      }
    }

    const flaky: FlakyTest[] = [];
    for (const [key, history] of testHistory) {
      if (history.total < 2) continue;
      const passRate = history.passes / history.total;
      const confidence = estimateFlakiness(passRate, history.total, history.failures);

      if (passRate < 1 && passRate > 0) {
        const [classname, name] = key.split('.', 2);
        flaky.push({
          name,
          classname,
          totalRuns: history.total,
          passRate: Math.round(passRate * 1000) / 10,
          confidence,
          failureTypes: [...new Set(history.failures)].slice(0, 3),
        });
      }
    }

    return flaky.sort((a, b) => a.passRate - b.passRate).slice(0, 5);
  }

  private identifySlowTests(): TestCase[] {
    const allTests = this.allTestCases();
    const threshold = this.computeSlowThreshold(allTests);
    return allTests
      .filter(t => t.time > threshold)
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
  }

  private computeSlowThreshold(tests: TestCase[]): number {
    if (tests.length === 0) return 5000;
    const times = tests.map(t => t.time).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    return Math.max(median * 3, 2000); // 3x median or at least 2s
  }

  private generateActionItems(
    failures: FailurePattern[],
    flaky: FlakyTest[],
    slow: TestCase[],
    health: HealthScore
  ): ActionItem[] {
    const items: ActionItem[] = [];

    // Critical: blocking failures
    const criticalFailures = failures.filter(f => f.category === 'AssertionError' || f.count >= 3);
    if (criticalFailures.length > 0) {
      items.push({
        priority: 'critical',
        title: `Fix ${criticalFailures.length} blocking test failure pattern(s)`,
        description: `${criticalFailures.map(f => `${f.type} (${f.count} occurrence${f.count > 1 ? 's' : ''})`).join(', ')}`,
        affectedTests: criticalFailures.flatMap(f => f.examples.slice(0, 2)),
        suggestion: 'Investigate root cause in application code. These failures block deployment and reduce team confidence.',
      });
    }

    // Warning: flaky tests
    if (flaky.length > 0) {
      const highConfidenceFlaky = flaky.filter(f => f.confidence === 'high');
      items.push({
        priority: highConfidenceFlaky.length > 0 ? 'critical' : 'warning',
        title: `Stabilize ${flaky.length} flaky test${flaky.length > 1 ? 's' : ''}`,
        description: `Tests with inconsistent pass rates (${flaky.map(f => `${f.name}: ${f.passRate}%`).join(', ')})`,
        affectedTests: flaky.map(f => f.name),
        suggestion: 'Add explicit waits, avoid race conditions, use test isolation, and mock unstable dependencies.',
      });
    }

    // Warning: slow tests
    if (slow.length > 0) {
      const totalSlowTime = slow.reduce((sum, t) => sum + t.time, 0);
      items.push({
        priority: 'warning',
        title: `Optimize ${slow.length} slow test${slow.length > 1 ? 's' : ''}`,
        description: `Top slow tests consume ${(totalSlowTime / 1000).toFixed(1)}s total`,
        affectedTests: slow.map(t => t.name),
        suggestion: 'Parallelize independent tests, reduce timeouts, use API-level setup instead of UI navigation.',
      });
    }

    // Info: coverage gaps
    if (health.coverage < 70) {
      items.push({
        priority: 'info',
        title: 'Consider expanding test coverage',
        description: `Current coverage indicator is at ${health.coverage}%. Focus on critical user paths.`,
        affectedTests: [],
        suggestion: 'Add tests for checkout flow, authentication edge cases, and error state handling.',
      });
    }

    // Info: trend
    if (health.trend === 'degrading') {
      items.push({
        priority: 'warning',
        title: 'Test health is degrading',
        description: 'Pass rate has declined compared to previous runs. Review recent changes.',
        affectedTests: [],
        suggestion: 'Run git bisect to identify the commit that introduced instability.',
      });
    }

    return items;
  }

  private generateNarrative(
    summary: IntelligenceReport['summary'],
    health: HealthScore,
    failures: FailurePattern[],
    flaky: FlakyTest[]
  ): string {
    const parts: string[] = [];

    // Opening: overall situation
    if (summary.failed === 0) {
      parts.push(`All ${summary.totalTests} tests passed in ${this.formatDuration(summary.duration)}. `);
      if (health.speed < 70) {
        parts.push(`However, test execution is slower than optimal, which delays feedback to developers.`);
      } else {
        parts.push(`Test suite health is strong.`);
      }
    } else {
      parts.push(`${summary.failed} of ${summary.totalTests} tests failed (${summary.passRate}% pass rate). `);
      if (health.trend === 'degrading') {
        parts.push(`This is a decline from previous runs — attention needed.`);
      } else {
        parts.push(`This is within normal variance, but should be investigated before merging.`);
      }
    }

    // Failure details
    if (failures.length > 0) {
      const topFailure = failures[0];
      parts.push(` The primary failure pattern is "${topFailure.type}" (${topFailure.count} occurrence${topFailure.count > 1 ? 's' : ''})`);
      if (topFailure.category === 'AssertionError') {
        parts.push(` — this suggests a regression in application behavior, not a test infrastructure issue.`);
      } else if (topFailure.category === 'TimeoutError') {
        parts.push(` — tests are timing out, suggesting performance degradation or missing wait conditions.`);
      } else if (topFailure.category === 'SelectorError') {
        parts.push(` — UI elements aren't being found, possibly due to layout changes or timing issues.`);
      } else {
        parts.push(`.`);
      }
    }

    // Flaky tests
    if (flaky.length > 0) {
      const highConfidence = flaky.filter(f => f.confidence === 'high');
      if (highConfidence.length > 0) {
        parts.push(` ${highConfidence.length} test${highConfidence.length > 1 ? 's show' : ' shows'} high-confidence flakiness`);
        parts.push(` — these erode trust in the suite and should be stabilized immediately.`);
      } else {
        parts.push(` ${flaky.length} test${flaky.length > 1 ? 's may be' : ' may be'} flaky, but more runs are needed for confirmation.`);
      }
    }

    // Closing: recommendation
    if (health.overall >= 80) {
      parts.push(` Overall recommendation: ship with confidence, but monitor the trends.`);
    } else if (health.overall >= 60) {
      parts.push(` Overall recommendation: investigate failures before merging to main.`);
    } else {
      parts.push(` Overall recommendation: block merge — fix critical failures first.`);
    }

    return parts.join('');
  }

  private generateExecutiveSummary(
    summary: IntelligenceReport['summary'],
    health: HealthScore,
    actions: ActionItem[]
  ): string {
    const lines: string[] = [];
    lines.push(`## Executive Summary`);
    lines.push('');
    lines.push(`**Overall Health Score: ${health.overall}/100** (${health.trend})`);
    lines.push('');
    lines.push(`| Metric | Value | Status |`);
    lines.push(`|--------|-------|--------|`);
    lines.push(`| Pass Rate | ${summary.passRate}% | ${summary.passRate >= 95 ? '✅' : summary.passRate >= 80 ? '⚠️' : '❌'} |`);
    lines.push(`| Tests Run | ${summary.totalTests} | — |`);
    lines.push(`| Duration | ${this.formatDuration(summary.duration)} | ${health.speed >= 80 ? '✅' : '⚠️'} |`);
    lines.push(`| Stability | ${health.stability}/100 | ${health.stability >= 80 ? '✅' : '⚠️'} |`);
    lines.push('');
    lines.push(`### Immediate Actions Required`);
    lines.push('');
    const criticalActions = actions.filter(a => a.priority === 'critical');
    if (criticalActions.length > 0) {
      criticalActions.forEach((a, i) => {
        lines.push(`${i + 1}. **${a.title}**: ${a.suggestion}`);
      });
    } else {
      lines.push('No critical actions. Monitor trends and continue current practices.');
    }
    lines.push('');
    lines.push(`_Generated at ${new Date().toLocaleString()}_`);

    return lines.join('\n');
  }

  private generateRecommendation(category: FailurePattern['category'], test: TestCase): string {
    const recommendations: Record<FailurePattern['category'], string> = {
      AssertionError: 'Review the expected vs actual values. The application behavior may have changed intentionally — update the test if so.',
      TimeoutError: 'Increase explicit waits, check for slow API responses, or parallelize independent operations.',
      SelectorError: 'Verify element selectors match current DOM. Consider using data-testid attributes for stability.',
      NetworkError: 'Check API availability, mock external dependencies, or add retry logic for transient failures.',
      UnknownError: 'Review the full stack trace. This is an unclassified error that needs manual investigation.',
    };
    return recommendations[category];
  }

  private allTestCases(): TestCase[] {
    return this.allTestCasesFromRun(this.run);
  }

  private allTestCasesFromRun(run: TestRun): TestCase[] {
    return run.testSuites.flatMap(s => s.testCases);
  }

  private computePassRate(run: TestRun): number {
    const tests = this.allTestCasesFromRun(run);
    const passed = tests.filter(t => t.status === 'passed').length;
    return tests.length > 0 ? (passed / tests.length) * 100 : 0;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  }
}
