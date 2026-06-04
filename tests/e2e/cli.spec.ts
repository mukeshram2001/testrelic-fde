/**
 * CLI Tool Tests — Smart Reporter
 * Tests the CLI commands work correctly with real XML output
 */

import { test, expect } from '@testrelic/playwright-analytics/fixture';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Smart Reporter CLI', () => {
  const binPath = path.join(process.cwd(), 'bin/smart-reporter.js');

  test('cli-version-command-outputs-version', () => {
    const output = execSync(`node ${binPath} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('cli-help-command-shows-usage', () => {
    const output = execSync(`node ${binPath} --help`, { encoding: 'utf-8' });
    expect(output).toContain('analyze');
    expect(output).toContain('watch');
    expect(output).toContain('config');
  });

  test('cli-config-command-validates-setup', () => {
    const output = execSync(`node ${binPath} config`, { encoding: 'utf-8' });
    expect(output).toContain('Smart Reporter Configuration');
    expect(output).toContain('Version');
  });

  test('cli-analyze-with-missing-file-shows-error', () => {
    let threw = false;
    try {
      execSync(`node ${binPath} analyze --input nonexistent.xml`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error: any) {
      threw = true;
      expect(error.stderr || error.stdout).toContain('not found');
    }
    expect(threw).toBe(true);
  });
});
