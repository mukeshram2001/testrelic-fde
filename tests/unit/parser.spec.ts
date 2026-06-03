/**
 * Unit Tests: JUnit XML Parser
 * Tests parsing of various JUnit XML formats that Playwright produces
 */

import { test, expect } from '@playwright/test';
import { JUnitParser } from '../../src/parser.js';

test.describe('JUnitParser', () => {
  const parser = new JUnitParser();

  test('parses-playwright-junit-single-suite', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Playwright Tests" tests="3" failures="1" errors="0" skipped="1" time="4.5">
  <testsuite name="auth.spec.ts" tests="3" failures="1" errors="0" skipped="1" time="4.5" timestamp="2024-01-15T10:30:00Z">
    <testcase name="login-success" classname="auth.spec.ts" time="1.2" status="passed"/>
    <testcase name="login-failure" classname="auth.spec.ts" time="0.8" status="failed">
      <failure message="expected home page, got login" type="AssertionError">Error: expected home page, got login at auth.spec.ts:42</failure>
    </testcase>
    <testcase name="login-timeout" classname="auth.spec.ts" time="2.5" status="skipped">
      <skipped message="temporarily disabled"/>
    </testcase>
  </testsuite>
</testsuites>`;

    const result = parser.parse(xml);

    expect(result.tests).toBe(3);
    expect(result.failures).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.testSuites).toHaveLength(1);
    expect(result.testSuites[0].testCases).toHaveLength(3);
    expect(result.testSuites[0].testCases[0].status).toBe('passed');
    expect(result.testSuites[0].testCases[1].status).toBe('failed');
    expect(result.testSuites[0].testCases[1].failure?.message).toBe('expected home page, got login');
    expect(result.testSuites[0].testCases[2].status).toBe('skipped');
  });

  test('parses-junit-single-suite-root', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="api.tests" tests="2" failures="0" errors="0" time="0.5" timestamp="2024-01-15T10:30:00Z">
  <testcase name="get-users" classname="api.tests" time="0.3"/>
  <testcase name="post-user" classname="api.tests" time="0.2"/>
</testsuite>`;

    const result = parser.parse(xml);
    expect(result.tests).toBe(2);
    expect(result.failures).toBe(0);
    expect(result.testSuites).toHaveLength(1);
  });

  test('parses-error-testcase-correctly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="error.tests" tests="1" failures="0" errors="1" time="5.0">
  <testcase name="network-call" classname="error.tests" time="5.0">
    <error message="Connection refused" type="NetworkError">Error: connect ECONNREFUSED 127.0.0.1:3000</error>
  </testcase>
</testsuite>`;

    const result = parser.parse(xml);
    expect(result.testSuites[0].testCases[0].status).toBe('error');
    expect(result.testSuites[0].testCases[0].failure?.type).toBe('NetworkError');
  });

  test('throws-on-invalid-xml', () => {
    expect(() => parser.parse('<invalid>')).toThrow();
  });
});
