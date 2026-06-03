/**
 * JUnit XML Parser
 * Handles Playwright JUnit output and transforms it into a structured TestRun
 * Supports both legacy and modern Playwright JUnit formats
 */

import { XMLParser } from 'fast-xml-parser';
import { TestRun, TestSuite, TestCase } from './types.js';
import * as fs from 'fs';

interface RawXMLTestCase {
  '@_name': string;
  '@_classname'?: string;
  '@_time'?: string;
  '@_status'?: string;
  failure?: { '@_message': string; '@_type': string; '#text'?: string } | Array<{ '@_message': string; '@_type': string; '#text'?: string }>;
  error?: { '@_message': string; '@_type': string; '#text'?: string };
  skipped?: { '@_message'?: string } | '';
  'system-out'?: string;
}

interface RawXMLSuite {
  '@_name': string;
  '@_timestamp'?: string;
  '@_hostname'?: string;
  '@_tests'?: string;
  '@_failures'?: string;
  '@_errors'?: string;
  '@_skipped'?: string;
  '@_time'?: string;
  testcase?: RawXMLTestCase | RawXMLTestCase[];
}

interface RawXMLRoot {
  testsuites?: {
    '@_name'?: string;
    '@_timestamp'?: string;
    '@_tests'?: string;
    '@_failures'?: string;
    '@_errors'?: string;
    '@_skipped'?: string;
    '@_time'?: string;
    testsuite?: RawXMLSuite | RawXMLSuite[];
  };
  testsuite?: RawXMLSuite;
}

export class JUnitParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      trimValues: true,
      parseTagValue: false,
    });
  }

  parseFile(filePath: string): TestRun {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }

  parse(xmlContent: string): TestRun {
    const raw: RawXMLRoot = this.parser.parse(xmlContent);

    if (raw.testsuites) {
      return this.parseTestSuites(raw.testsuites);
    } else if (raw.testsuite) {
      const suite = this.parseTestSuite(raw.testsuite);
      return {
        name: suite.name,
        timestamp: suite.timestamp,
        tests: suite.tests,
        failures: suite.failures,
        errors: suite.errors,
        skipped: suite.skipped,
        time: suite.time,
        testSuites: [suite],
      };
    }

    throw new Error('Invalid JUnit XML: no <testsuites> or <testsuite> root found');
  }

  private parseTestSuites(raw: RawXMLRoot['testsuites']): TestRun {
    const suites = this.normalizeArray(raw!.testsuite).map(s => this.parseTestSuite(s));
    
    return {
      name: raw!['@_name'] || 'Test Run',
      timestamp: raw!['@_timestamp'] || new Date().toISOString(),
      tests: parseInt(raw!['@_tests'] || '0', 10) || suites.reduce((sum, s) => sum + s.tests, 0),
      failures: parseInt(raw!['@_failures'] || '0', 10) || suites.reduce((sum, s) => sum + s.failures, 0),
      errors: parseInt(raw!['@_errors'] || '0', 10) || suites.reduce((sum, s) => sum + s.errors, 0),
      skipped: parseInt(raw!['@_skipped'] || '0', 10) || suites.reduce((sum, s) => sum + s.skipped, 0),
      time: parseFloat(raw!['@_time'] || '0') || suites.reduce((sum, s) => sum + s.time, 0),
      testSuites: suites,
    };
  }

  private parseTestSuite(raw: RawXMLSuite): TestSuite {
    const cases = this.normalizeArray(raw.testcase).map(c => this.parseTestCase(c));
    
    return {
      name: raw['@_name'],
      timestamp: raw['@_timestamp'] || new Date().toISOString(),
      hostname: raw['@_hostname'],
      tests: parseInt(raw['@_tests'] || '0', 10) || cases.length,
      failures: parseInt(raw['@_failures'] || '0', 10) || cases.filter(c => c.status === 'failed').length,
      errors: parseInt(raw['@_errors'] || '0', 10) || cases.filter(c => c.status === 'error').length,
      skipped: parseInt(raw['@_skipped'] || '0', 10) || cases.filter(c => c.status === 'skipped').length,
      time: parseFloat(raw['@_time'] || '0') || cases.reduce((sum, c) => sum + c.time, 0),
      testCases: cases,
    };
  }

  private parseTestCase(raw: RawXMLTestCase): TestCase {
    const status = this.inferStatus(raw);
    const failure = this.extractFailure(raw);

    return {
      name: raw['@_name'],
      classname: raw['@_classname'] || 'unknown',
      time: parseFloat(raw['@_time'] || '0'),
      status,
      failure: failure || undefined,
      systemOut: raw['system-out'],
    };
  }

  private inferStatus(raw: RawXMLTestCase): TestCase['status'] {
    if (raw.failure) return 'failed';
    if (raw.error) return 'error';
    if (raw.skipped !== undefined) return 'skipped';
    return 'passed';
  }

  private extractFailure(raw: RawXMLTestCase): { message: string; type: string; stackTrace?: string } | null {
    if (raw.failure) {
      const f = Array.isArray(raw.failure) ? raw.failure[0] : raw.failure;
      return {
        message: f['@_message'],
        type: f['@_type'],
        stackTrace: f['#text'],
      };
    }
    if (raw.error) {
      const e = raw.error;
      return {
        message: e['@_message'],
        type: e['@_type'],
        stackTrace: e['#text'],
      };
    }
    return null;
  }

  private normalizeArray<T>(val: T | T[] | undefined): T[] {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }
}

export function parseJUnitFile(filePath: string): TestRun {
  const parser = new JUnitParser();
  return parser.parseFile(filePath);
}
