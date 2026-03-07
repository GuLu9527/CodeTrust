import { describe, it, expect } from 'vitest';
import { ScanEngine } from '../../src/core/engine.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import * as path from 'node:path';

const defaultConfig = DEFAULT_CONFIG;

describe('integration: scan engine', () => {
  it('should scan test-ai-code.ts and find issues', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    expect(report.overall.score).toBeLessThan(90);
    expect(report.overall.issuesFound).toBeGreaterThan(10);
    expect(report.dimensions.logic.score).toBeLessThan(50);
    expect(report.dimensions.security.score).toBe(100);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it('should scan a clean file with no issues', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/sample-clean.ts'],
    });

    expect(report.dimensions.logic.score).toBe(100);
  });

  it('should produce JSON-serializable report', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed.overall.score).toBe(report.overall.score);
    expect(parsed.issues.length).toBe(report.issues.length);
  });
});
