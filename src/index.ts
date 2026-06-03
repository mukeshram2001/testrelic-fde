/**
 * TestRelic Smart Reporter
 * AI-powered Playwright test intelligence
 * 
 * Core modules:
 * - parser: JUnit XML parsing
 * - intelligence: Analysis engine
 * - formatter: Multi-format output rendering
 * - classifier: Failure categorization
 * - uploader: TestRelic cloud integration
 * - watcher: File system monitoring
 */

export { JUnitParser, parseJUnitFile } from './parser.js';
export { IntelligenceEngine } from './intelligence.js';
export { ReportFormatter } from './formatter.js';
export { TestRelicUploader } from './uploader.js';
export { FileWatcher } from './watcher.js';
export * from './types.js';
