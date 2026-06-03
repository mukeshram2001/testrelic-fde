/**
 * Failure Classification Engine
 * Uses pattern matching and heuristics to categorize test failures
 * This enables the tool to provide specific, actionable recommendations
 */

import { FailurePattern } from './types.js';

type FailureCategory = FailurePattern['category'];

// Pattern database for categorizing failures
const PATTERNS: { category: FailureCategory; keywords: string[]; typePatterns: RegExp[] }[] = [
  {
    category: 'TimeoutError',
    keywords: [
      'timeout', 'timed out', 'exceeded', 'exceeds', 'waiting for',
      'locator.waitfor', 'page.waitfor', 'expect.poll',
    ],
    typePatterns: [/timeout/i, /wait/i, /polling/i],
  },
  {
    category: 'SelectorError',
    keywords: [
      'selector', 'element not found', 'no element', 'strict mode',
      'resolved to', 'ambiguous', 'locator', 'frame not found',
      'cannot find', 'unable to locate',
    ],
    typePatterns: [/selector/i, /locator/i, /element/i, /strict/i],
  },
  {
    category: 'AssertionError',
    keywords: [
      'expect', 'assertion', 'assert', 'to be', 'to have', 'to equal',
      'to contain', 'to match', 'snapshot', 'mismatch', 'strict equal',
    ],
    typePatterns: [/assert/i, /expect/i, /snapshot/i, /mismatch/i],
  },
  {
    category: 'NetworkError',
    keywords: [
      'net::', 'failed to fetch', 'network', 'connection refused',
      'econnrefused', 'etimedout', 'dns', 'ssl', 'certificate',
      '404', '500', '503', 'status code',
    ],
    typePatterns: [/network/i, /fetch/i, /http/i, /connection/i, /econn/i],
  },
];

export function categorizeFailure(message: string, type?: string): FailureCategory {
  const lowerMessage = (message || '').toLowerCase();
  const lowerType = (type || '').toLowerCase();

  // Check type patterns first (more reliable)
  for (const pattern of PATTERNS) {
    for (const regex of pattern.typePatterns) {
      if (regex.test(lowerType)) return pattern.category;
    }
  }

  // Fall back to keyword matching in message
  for (const pattern of PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return pattern.category;
      }
    }
  }

  return 'UnknownError';
}

export function extractErrorContext(message?: string, stackTrace?: string): string {
  if (!message && !stackTrace) return 'Unknown error — no details available';

  // Extract the most meaningful line from the message
  const cleanMessage = (message || '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanMessage.length < 150) return cleanMessage;

  // For long messages, extract the core assertion or key phrase
  const match = cleanMessage.match(/^Error: (.+?)(?=\s+at\s+|$)/);
  if (match) return match[1].trim();

  return cleanMessage.substring(0, 150) + (cleanMessage.length > 150 ? '...' : '');
}

export function estimateFlakiness(
  passRate: number,
  totalRuns: number,
  failureTypes: string[]
): 'high' | 'medium' | 'low' {
  // High confidence: many runs, middle pass rate, consistent failure types
  if (totalRuns >= 5 && passRate > 20 && passRate < 80) {
    const uniqueTypes = new Set(failureTypes);
    if (uniqueTypes.size <= 2) return 'high';
    return 'medium';
  }

  // Medium: some runs, borderline pass rate
  if (totalRuns >= 3 && passRate > 10 && passRate < 90) return 'medium';

  // Low: insufficient data or extreme pass rate
  return 'low';
}

export function suggestFix(category: FailureCategory): string {
  const fixes: Record<FailureCategory, string> = {
    AssertionError: 'Update test expectations to match current application behavior, or fix the underlying bug if behavior is unintended.',
    TimeoutError: 'Add explicit wait conditions, increase timeout for slow operations, or optimize the operation being tested.',
    SelectorError: 'Update selectors to match current DOM structure, add data-testid attributes, or handle dynamic content loading.',
    NetworkError: 'Check API health, mock external dependencies in tests, or add retry logic for transient failures.',
    UnknownError: 'Investigate the full error context. This is an unclassified error — may need manual debugging.',
  };
  return fixes[category];
}
