/**
 * Output Formatters
 * Renders the IntelligenceReport into multiple output formats:
 * - terminal: Rich CLI output with colors, boxes, and visual hierarchy
 * - json: Machine-readable for CI pipelines and integrations
 * - markdown: For GitHub PR comments, Slack notifications, documentation
 * - html: Standalone dashboard for sharing
 */

import chalk from 'chalk';
import boxen from 'boxen';
import { IntelligenceReport, ActionItem } from './types.js';

export class ReportFormatter {
  private report: IntelligenceReport;

  constructor(report: IntelligenceReport) {
    this.report = report;
  }

  // ═══════════════════════════════════════════════════════════════
  // TERMINAL FORMAT — Rich, visual CLI output
  // ═══════════════════════════════════════════════════════════════
  toTerminal(): string {
    const lines: string[] = [];
    const { summary, healthScore, topFailures, flakyTests, slowTests, actionItems, narrative } = this.report;

    // Header
    lines.push(boxen(
      chalk.bold.white('📊 TESTRELIC SMART REPORTER') + '\n' +
      chalk.gray(`${new Date(this.report.generatedAt).toLocaleString()}`),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan', dimBorder: false }
    ));

    lines.push('');

    // Executive Summary Box
    const healthColor = healthScore.overall >= 80 ? 'green' : healthScore.overall >= 60 ? 'yellow' : 'red';
    const healthEmoji = healthScore.overall >= 80 ? '✅' : healthScore.overall >= 60 ? '⚠️' : '❌';
    const trendIcon = healthScore.trend === 'improving' ? '📈' : healthScore.trend === 'degrading' ? '📉' : '➡️';

    lines.push(boxen(
      chalk.bold[healthColor](`${healthEmoji} Health Score: ${healthScore.overall}/100`) + ' ' + trendIcon + '\n' +
      chalk.white(`Pass Rate: ${summary.passRate}%  |  Tests: ${summary.totalTests}  |  Duration: ${this.formatDuration(summary.duration)}`) + '\n' +
      chalk.gray(healthScore.summary),
      { padding: 1, borderStyle: 'round', borderColor: healthColor }
    ));

    lines.push('');

    // Narrative
    lines.push(chalk.bold.cyan('📝 What Happened'));
    lines.push(chalk.white(narrative));
    lines.push('');

    // Action Items
    if (actionItems.length > 0) {
      lines.push(chalk.bold.cyan('🎯 Action Items'));
      for (const item of actionItems) {
        const color = item.priority === 'critical' ? 'red' : item.priority === 'warning' ? 'yellow' : 'blue';
        const emoji = item.priority === 'critical' ? '🔴' : item.priority === 'warning' ? '🟡' : '🔵';
        lines.push(`  ${emoji} ${chalk.bold[color](item.title)}`);
        lines.push(`     ${chalk.gray(item.description)}`);
        lines.push(`     ${chalk.white('→')} ${chalk.italic(item.suggestion)}`);
        lines.push('');
      }
    }

    // Top Failures
    if (topFailures.length > 0) {
      lines.push(chalk.bold.cyan('🔥 Top Failure Patterns'));
      for (const f of topFailures) {
        const catEmoji = this.categoryEmoji(f.category);
        lines.push(`  ${catEmoji} ${chalk.bold.white(f.type)} ${chalk.gray(`(${f.count}× ${f.category})`)}`);
        lines.push(`     ${chalk.yellow('💡')} ${chalk.italic(f.recommendation)}`);
        for (const ex of f.examples) {
          lines.push(`     ${chalk.gray('└─')} ${chalk.gray(ex.substring(0, 100))}${ex.length > 100 ? '...' : ''}`);
        }
      }
      lines.push('');
    }

    // Flaky Tests
    if (flakyTests.length > 0) {
      lines.push(chalk.bold.cyan('🎲 Potentially Flaky Tests'));
      for (const t of flakyTests) {
        const confColor = t.confidence === 'high' ? 'red' : t.confidence === 'medium' ? 'yellow' : 'gray';
        lines.push(`  ${chalk[confColor](`${t.passRate}% pass rate`)} ${chalk.white(t.name)} ${chalk.gray(`[${t.confidence} confidence]`)}`);
      }
      lines.push('');
    }

    // Slow Tests
    if (slowTests.length > 0) {
      lines.push(chalk.bold.cyan('🐌 Slow Tests'));
      for (const t of slowTests) {
        lines.push(`  ${chalk.yellow(`${this.formatDuration(t.time)}`)} ${chalk.white(t.name)}`);
      }
      lines.push('');
    }

    // Footer
    lines.push(chalk.gray('─'.repeat(60)));
    lines.push(chalk.gray('Powered by TestRelic Smart Reporter • https://testrelic.ai'));

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // JSON FORMAT — Machine-readable for CI/CD integrations
  // ═══════════════════════════════════════════════════════════════
  toJSON(pretty = true): string {
    return JSON.stringify(this.report, null, pretty ? 2 : 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKDOWN FORMAT — For PR comments, Slack, documentation
  // ═══════════════════════════════════════════════════════════════
  toMarkdown(): string {
    const { summary, healthScore, topFailures, flakyTests, slowTests, actionItems } = this.report;

    const lines: string[] = [];
    lines.push('## 🧪 Test Run Intelligence Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date(this.report.generatedAt).toLocaleString()}`);
    lines.push(`**Project:** ${this.report.run.name}`);
    lines.push('');

    // Health Score
    const healthEmoji = healthScore.overall >= 80 ? '✅' : healthScore.overall >= 60 ? '⚠️' : '❌';
    lines.push(`### ${healthEmoji} Health Score: ${healthScore.overall}/100 (${healthScore.trend})`);
    lines.push('');
    lines.push(`| Metric | Score |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Overall | ${healthScore.overall}/100 |`);
    lines.push(`| Stability | ${healthScore.stability}/100 |`);
    lines.push(`| Speed | ${healthScore.speed}/100 |`);
    lines.push(`| Coverage | ${healthScore.coverage}/100 |`);
    lines.push('');

    // Summary
    lines.push('### 📊 Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Tests | ${summary.totalTests} |`);
    lines.push(`| Passed | ${summary.passed} ✅ |`);
    lines.push(`| Failed | ${summary.failed} ${summary.failed > 0 ? '❌' : ''} |`);
    lines.push(`| Skipped | ${summary.skipped} |`);
    lines.push(`| Pass Rate | ${summary.passRate}% |`);
    lines.push(`| Duration | ${this.formatDuration(summary.duration)} |`);
    lines.push('');

    // Narrative
    lines.push('### 📝 Narrative');
    lines.push('');
    lines.push(this.report.narrative);
    lines.push('');

    // Action Items
    if (actionItems.length > 0) {
      lines.push('### 🎯 Action Items');
      lines.push('');
      for (const item of actionItems) {
        const emoji = item.priority === 'critical' ? '🔴' : item.priority === 'warning' ? '🟡' : '🔵';
        lines.push(`**${emoji} ${item.title}**  `);
        lines.push(`Priority: \`${item.priority.toUpperCase()}\`  `);
        lines.push(`${item.description}  `);
        lines.push(`💡 *Suggestion:* ${item.suggestion}`);
        lines.push('');
      }
    }

    // Failures
    if (topFailures.length > 0) {
      lines.push('### 🔥 Top Failure Patterns');
      lines.push('');
      for (const f of topFailures) {
        lines.push(`**${f.type}** (${f.count} occurrences) — \`${f.category}\``);
        lines.push('');
        lines.push(`💡 ${f.recommendation}`);
        if (f.examples.length > 0) {
          lines.push('');
          lines.push('```');
          for (const ex of f.examples) lines.push(ex);
          lines.push('```');
        }
        lines.push('');
      }
    }

    // Flaky
    if (flakyTests.length > 0) {
      lines.push('### 🎲 Potentially Flaky Tests');
      lines.push('');
      lines.push(`| Test | Pass Rate | Confidence | Failure Types |`);
      lines.push(`|------|-----------|------------|---------------|`);
      for (const t of flakyTests) {
        lines.push(`| ${t.name} | ${t.passRate}% | ${t.confidence} | ${t.failureTypes.join(', ')} |`);
      }
      lines.push('');
    }

    // Slow
    if (slowTests.length > 0) {
      lines.push('### 🐌 Slow Tests');
      lines.push('');
      lines.push(`| Test | Duration |`);
      lines.push(`|------|----------|`);
      for (const t of slowTests) {
        lines.push(`| ${t.name} | ${this.formatDuration(t.time)} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*Generated by [TestRelic Smart Reporter](https://testrelic.ai)*');

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // HTML FORMAT — Standalone dashboard
  // ═══════════════════════════════════════════════════════════════
  toHTML(): string {
    const { summary, healthScore, topFailures, flakyTests, slowTests, actionItems } = this.report;
    const healthColor = healthScore.overall >= 80 ? '#10b981' : healthScore.overall >= 60 ? '#f59e0b' : '#ef4444';

    const actionItemsHTML = actionItems.map(item => {
      const priorityClass = `action-${item.priority}`;
      const badgeClass = `badge-${item.priority}`;
      return `
        <div class="action-card ${priorityClass}">
          <div class="action-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="action-badge ${badgeClass}">${item.priority}</span>
            </div>
            <div class="action-title">${item.title}</div>
            <div class="action-desc">${item.description}</div>
            <div class="action-tip">
              <span class="action-tip-icon">💡</span>
              <span><strong>Suggestion:</strong> ${item.suggestion}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const failuresHTML = topFailures.map(f => {
      const examplesHTML = f.examples.map(ex => `
        <div style="margin-top: 8px;">
          <pre class="failure-logs"><code>${ex.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        </div>
      `).join('');
      return `
        <div class="failure-item">
          <div class="failure-header">
            <div class="failure-title">
              <span>⚠️</span>
              <span>${f.type}</span>
            </div>
            <span class="failure-count">${f.count} occurrences</span>
          </div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Category: <strong>${f.category}</strong></div>
          <div class="failure-rec">
            <strong>Recommendation:</strong> ${f.recommendation}
          </div>
          ${examplesHTML}
        </div>
      `;
    }).join('');

    const flakyTestsHTML = flakyTests.map(t => {
      const confBadgeClass = t.confidence === 'high' ? 'badge-critical' : t.confidence === 'medium' ? 'badge-warning' : 'badge-info';
      return `
        <tr>
          <td style="font-weight: 500;">${t.name}</td>
          <td>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${t.passRate}%; background: ${t.passRate >= 80 ? 'var(--success)' : t.passRate >= 50 ? 'var(--warning)' : 'var(--danger)'};"></div>
            </div>
            <span style="font-weight: 600;">${t.passRate}%</span>
          </td>
          <td><span class="action-badge ${confBadgeClass}">${t.confidence}</span></td>
          <td style="color: var(--text-secondary); font-size: 13px;">${t.failureTypes.join(', ') || 'N/A'}</td>
        </tr>
      `;
    }).join('');

    const slowTestsHTML = slowTests.map(t => {
      return `
        <tr>
          <td style="font-weight: 500;">${t.name}</td>
          <td style="font-weight: 600; color: var(--warning);">${this.formatDuration(t.time)}</td>
        </tr>
      `;
    }).join('');

    const trendIcon = healthScore.trend === 'improving' ? '📈' : healthScore.trend === 'degrading' ? '📉' : '➡️';
    const trendClass = `trend-${healthScore.trend}`;
    const trendText = healthScore.trend.charAt(0).toUpperCase() + healthScore.trend.slice(1);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestRelic Smart Report — ${this.report.run.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --bg-primary: #0b0f19;
      --bg-secondary: #111827;
      --card-bg: rgba(17, 24, 39, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --accent-purple: #8b5cf6;
      --accent-cyan: #06b6d4;
      --accent-blue: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --health-color-raw: ${healthColor};
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background-color: var(--bg-primary);
      background-image: 
        radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.07) 0px, transparent 50%),
        radial-gradient(at 50% 0%, rgba(6, 182, 212, 0.05) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(59, 130, 246, 0.07) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text-primary);
      padding: 40px 20px;
      line-height: 1.5;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 20px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
    }

    .brand-icon svg {
      width: 24px;
      height: 24px;
      fill: white;
    }

    .brand-text h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 24px;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 30%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-text p {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .meta-badge {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 13px;
      color: var(--text-secondary);
      backdrop-filter: blur(10px);
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    @media (max-width: 900px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 28px;
      backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255,255,255,0.15) inset;
    }

    .health-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .health-card::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 60%);
      pointer-events: none;
    }

    .health-ring-container {
      position: relative;
      width: 160px;
      height: 160px;
      margin: 20px 0;
    }

    .health-ring svg {
      transform: rotate(-90deg);
    }

    .health-ring-glow {
      filter: drop-shadow(0 0 8px var(--health-color-raw));
    }

    .health-display-val {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }

    .health-num {
      font-family: 'Outfit', sans-serif;
      font-size: 48px;
      font-weight: 800;
      line-height: 1;
      color: var(--health-color-raw);
    }

    .health-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .health-trend {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 9999px;
      margin-top: 8px;
    }

    .trend-improving {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
    }
    .trend-degrading {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
    }
    .trend-stable {
      background: rgba(59, 130, 246, 0.1);
      color: var(--accent-blue);
    }

    .health-breakdown {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      width: 100%;
      margin-top: 24px;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 20px;
    }

    .subscore {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .subscore-value {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 700;
    }

    .subscore-label {
      font-size: 10px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-item {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      border-radius: 16px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      transition: background-color 0.2s;
    }

    .summary-item:hover {
      background: rgba(255,255,255,0.04);
    }

    .summary-val {
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .summary-lbl {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 6px;
    }

    .summary-icon {
      margin-bottom: 12px;
      color: var(--text-secondary);
    }

    .narrative-box {
      background: rgba(59, 130, 246, 0.04);
      border: 1px solid rgba(59, 130, 246, 0.15);
      border-radius: 16px;
      padding: 20px;
      position: relative;
      line-height: 1.6;
    }

    .narrative-title {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: var(--accent-blue);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-container {
      margin-bottom: 32px;
    }

    .section-hdr {
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #fff, var(--text-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .action-items-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .action-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
      position: relative;
      overflow: hidden;
    }

    .action-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
    }

    .action-critical::after { background: var(--danger); }
    .action-warning::after { background: var(--warning); }
    .action-info::after { background: var(--accent-blue); }

    .action-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 8px;
      border-radius: 6px;
      width: fit-content;
    }

    .badge-critical { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
    .badge-warning { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
    .badge-info { background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); }

    .action-content {
      flex-grow: 1;
    }

    .action-title {
      font-family: 'Outfit', sans-serif;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .action-desc {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 12px;
    }

    .action-tip {
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-primary);
      display: flex;
      gap: 8px;
    }

    .action-tip-icon {
      color: var(--warning);
    }

    .failures-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .failure-item {
      background: rgba(239, 68, 68, 0.02);
      border: 1px solid rgba(239, 68, 68, 0.1);
      border-radius: 16px;
      padding: 20px;
    }

    .failure-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }

    .failure-title {
      font-family: 'Outfit', sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .failure-count {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--danger);
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .failure-rec {
      background: rgba(245, 158, 11, 0.05);
      border-left: 3px solid var(--warning);
      padding: 10px 14px;
      font-size: 13px;
      color: #fef3c7;
      margin-bottom: 12px;
      border-radius: 0 8px 8px 0;
    }

    .failure-logs {
      background: #070a13;
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 10px;
      padding: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #e2e8f0;
      overflow-x: auto;
      white-space: pre-wrap;
      max-height: 250px;
    }

    .table-container {
      width: 100%;
      overflow-x: auto;
      border-radius: 16px;
      border: 1px solid var(--card-border);
      background: rgba(17, 24, 39, 0.3);
    }

    .custom-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
    }

    .custom-table th {
      background: rgba(255,255,255,0.02);
      color: var(--text-secondary);
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      padding: 14px 20px;
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }

    .custom-table td {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }

    .custom-table tr:last-child td {
      border-bottom: none;
    }

    .progress-bar-bg {
      background: rgba(255,255,255,0.05);
      height: 6px;
      border-radius: 9999px;
      width: 100px;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 9999px;
    }

    .footer-text {
      text-align: center;
      color: var(--text-secondary);
      font-size: 12px;
      margin-top: 48px;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-section">
      <div class="brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>TestRelic Smart Report</h1>
          <p>AI-Powered Test Intelligence & Run Analysis</p>
        </div>
      </div>
      <div class="meta-badge">
        <strong>Project:</strong> ${this.report.run.name} &bull; ${new Date(this.report.generatedAt).toLocaleString()}
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Health Card -->
      <div class="card health-card">
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 600;">Run Health Score</h3>
        <div class="health-ring-container">
          <div class="health-ring">
            <svg width="160" height="160" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="8"/>
              <circle class="health-ring-glow" cx="60" cy="60" r="52" fill="none" stroke="var(--health-color-raw)" stroke-width="8"
                stroke-dasharray="${2 * Math.PI * 52}" stroke-dashoffset="${2 * Math.PI * 52 * (1 - healthScore.overall / 100)}"
                stroke-linecap="round"/>
            </svg>
          </div>
          <div class="health-display-val">
            <div class="health-num">${healthScore.overall}</div>
            <div class="health-label">Score</div>
          </div>
        </div>
        
        <span class="health-trend ${trendClass}">${trendIcon} ${trendText}</span>
        
        <div class="health-breakdown">
          <div class="subscore">
            <span class="subscore-value" style="color: var(--success);">${healthScore.stability}/100</span>
            <span class="subscore-label">Stability</span>
          </div>
          <div class="subscore">
            <span class="subscore-value" style="color: var(--accent-cyan);">${healthScore.speed}/100</span>
            <span class="subscore-label">Speed</span>
          </div>
          <div class="subscore">
            <span class="subscore-value" style="color: var(--accent-purple);">${healthScore.coverage}/100</span>
            <span class="subscore-label">Coverage</span>
          </div>
        </div>
      </div>

      <!-- Right Column: Summary & Narrative -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Metrics Summary Grid -->
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-val">${summary.totalTests}</div>
            <div class="summary-lbl">Total Tests</div>
          </div>
          <div class="summary-item" style="border-bottom: 2px solid var(--success);">
            <div class="summary-val" style="color: var(--success);">${summary.passed}</div>
            <div class="summary-lbl">Passed</div>
          </div>
          <div class="summary-item" style="border-bottom: 2px solid ${summary.failed > 0 ? 'var(--danger)' : 'var(--card-border)'};">
            <div class="summary-val" style="color: ${summary.failed > 0 ? 'var(--danger)' : 'var(--text-primary)'};">${summary.failed}</div>
            <div class="summary-lbl">Failed</div>
          </div>
          <div class="summary-item">
            <div class="summary-val">${summary.passRate}%</div>
            <div class="summary-lbl">Pass Rate</div>
          </div>
          <div class="summary-item">
            <div class="summary-val">${this.formatDuration(summary.duration)}</div>
            <div class="summary-lbl">Duration</div>
          </div>
        </div>

        <!-- Executive Narrative -->
        <div class="card" style="flex-grow: 1; padding: 24px;">
          <div class="narrative-box">
            <div class="narrative-title">
              <svg style="width: 18px; height: 18px; fill: currentColor;" viewBox="0 0 24 24">
                <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
              Executive Summary
            </div>
            <p style="color: var(--text-primary); font-size: 14.5px; line-height: 1.6;">${healthScore.summary}. ${this.report.narrative}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Items Section -->
    ${actionItems.length > 0 ? `
    <div class="section-container">
      <h2 class="section-hdr">
        <svg style="width: 20px; height: 20px; fill: var(--accent-purple);" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Action Items
      </h2>
      <div class="action-items-list">
        ${actionItemsHTML}
      </div>
    </div>
    ` : ''}

    <!-- Top Failure Patterns Section -->
    ${topFailures.length > 0 ? `
    <div class="section-container">
      <h2 class="section-hdr">
        <svg style="width: 20px; height: 20px; fill: var(--danger);" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        Failure Patterns Detected
      </h2>
      <div class="failures-grid">
        ${failuresHTML}
      </div>
    </div>
    ` : ''}

    <!-- Flaky Tests Section -->
    ${flakyTests.length > 0 ? `
    <div class="section-container">
      <h2 class="section-hdr">
        <svg style="width: 20px; height: 20px; fill: var(--warning);" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.25z"/>
        </svg>
        Potentially Flaky Tests
      </h2>
      <div class="table-container">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Test Name</th>
              <th>Pass Rate</th>
              <th>Flake Confidence</th>
              <th>Observed Failure Types</th>
            </tr>
          </thead>
          <tbody>
            ${flakyTestsHTML}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Slow Tests Section -->
    ${slowTests.length > 0 ? `
    <div class="section-container">
      <h2 class="section-hdr">
        <svg style="width: 20px; height: 20px; fill: var(--accent-cyan);" viewBox="0 0 24 24">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm3.3 14.71L11 12.41V7h2v4.59l3.7 3.71-1.41 1.41z"/>
        </svg>
        Slowest Tests
      </h2>
      <div class="table-container">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Test Name</th>
              <th>Execution Time</th>
            </tr>
          </thead>
          <tbody>
            ${slowTestsHTML}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <div class="footer-text">
      Powered by <strong>TestRelic Smart Reporter</strong> &bull; Version 1.0.0 &bull; <a href="https://testrelic.ai" style="color: var(--accent-cyan); text-decoration: none;">testrelic.ai</a>
    </div>
  </div>
</body>
</html>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPACT FORMAT — For Slack/Chat notifications
  // ═══════════════════════════════════════════════════════════════
  toCompact(): string {
    const { summary, healthScore, actionItems } = this.report;
    const healthEmoji = healthScore.overall >= 80 ? '✅' : healthScore.overall >= 60 ? '⚠️' : '❌';
    const lines: string[] = [
      `*🧪 Test Run — ${healthEmoji} ${healthScore.overall}/100*`,
      `${summary.passed}/${summary.totalTests} passed (${summary.passRate}%) in ${this.formatDuration(summary.duration)}`,
    ];

    if (actionItems.length > 0) {
      const critical = actionItems.filter(a => a.priority === 'critical');
      if (critical.length > 0) lines.push(`🔴 *${critical.length} critical action(s) required*`);
    }

    return lines.join('\n');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  }

  private categoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      AssertionError: '🔍',
      TimeoutError: '⏱️',
      SelectorError: '🎯',
      NetworkError: '🌐',
      UnknownError: '❓',
    };
    return emojis[category] || '❓';
  }
}
