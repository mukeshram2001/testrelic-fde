/**
 * Core type definitions for the Smart Reporter
 * Represents the domain model for test result intelligence
 */

export interface TestCase {
  name: string;
  classname: string;
  time: number;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  failure?: {
    message: string;
    type: string;
    stackTrace?: string;
  };
  systemOut?: string;
  timestamp?: string;
  flaky?: boolean;
}

export interface TestSuite {
  name: string;
  timestamp: string;
  hostname?: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testCases: TestCase[];
}

export interface TestRun {
  name: string;
  timestamp: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testSuites: TestSuite[];
}

export interface FailurePattern {
  type: string;
  category: 'AssertionError' | 'TimeoutError' | 'SelectorError' | 'NetworkError' | 'UnknownError';
  count: number;
  examples: string[];
  recommendation: string;
}

export interface FlakyTest {
  name: string;
  classname: string;
  totalRuns: number;
  passRate: number;
  confidence: 'high' | 'medium' | 'low';
  failureTypes: string[];
}

export interface HealthScore {
  overall: number;
  stability: number;
  speed: number;
  coverage: number;
  trend: 'improving' | 'stable' | 'degrading';
  summary: string;
}

export interface ActionItem {
  priority: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedTests: string[];
  suggestion: string;
}

export interface IntelligenceReport {
  run: TestRun;
  generatedAt: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    passRate: number;
  };
  healthScore: HealthScore;
  topFailures: FailurePattern[];
  flakyTests: FlakyTest[];
  slowTests: TestCase[];
  actionItems: ActionItem[];
  narrative: string;
  executiveSummary: string;
}
