import { describe, it, expect, afterEach } from 'vitest';
import { ScanEngine } from '../../src/core/engine.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import { renderJsonReport } from '../../src/cli/output/json.js';
import { RuleEngine } from '../../src/rules/engine.js';
import { resetLocaleCache } from '../../src/i18n/index.js';
import type { RuleRunResult } from '../../src/types/index.js';
import * as path from 'node:path';

const defaultConfig = DEFAULT_CONFIG;

afterEach(() => {
  delete process.env.CODETRUST_LANG;
  resetLocaleCache();
});

describe('integration: scan engine', () => {
  it('should scan test-ai-code.ts and find issues', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.scanMode).toBe('files');
    expect(report.overall.score).toBeLessThan(90);
    expect(report.overall.issuesFound).toBeGreaterThan(10);
    expect(report.dimensions.logic.score).toBeLessThan(50);
    expect(report.dimensions.security.score).toBe(100);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.issues.every((issue) => issue.fingerprint.length > 0)).toBe(true);
    expect(report.issues.every((issue) => issue.fingerprintVersion === '1')).toBe(true);
    expect(report.toolHealth.filesConsidered).toBe(1);
    expect(report.toolHealth.filesScanned).toBe(1);
  });

  it('should scan a clean file with no issues', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/sample-clean.ts'],
    });

    expect(report.dimensions.logic.score).toBe(100);
    expect(report.toolHealth.rulesFailed).toBeGreaterThanOrEqual(0);
  });

  it('should enforce include and exclude config during candidate selection', async () => {
    const config = {
      ...defaultConfig,
      include: ['tests/fixtures/sample-clean.ts'],
      exclude: [],
    };
    const engine = new ScanEngine(config, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    expect(report.toolHealth.filesConsidered).toBe(1);
    expect(report.toolHealth.filesExcluded).toBe(1);
    expect(report.toolHealth.filesScanned).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it('should surface rule failures in tool health without aborting the scan', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..')) as ScanEngine & {
      ruleEngine: Pick<RuleEngine, 'runWithDiagnostics'>;
    };

    engine.ruleEngine = {
      runWithDiagnostics: () => ({
        issues: [],
        rulesExecuted: 1,
        rulesFailed: 1,
        ruleFailures: [
          {
            ruleId: 'test/throwing-rule',
            file: 'tests/fixtures/sample-clean.ts',
            message: 'boom',
          },
        ],
      } satisfies RuleRunResult),
    };

    const report = await engine.scan({
      files: ['tests/fixtures/sample-clean.ts'],
    });

    expect(report.toolHealth.rulesFailed).toBe(1);
    expect(report.toolHealth.ruleFailures).toEqual([
      {
        ruleId: 'test/throwing-rule',
        file: 'tests/fixtures/sample-clean.ts',
        message: 'boom',
      },
    ]);
    expect(report.toolHealth.scanErrors).toEqual([]);
  });

  it('should produce JSON schema v1 output', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    const json = renderJsonReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.toolHealth.rulesExecuted).toBeGreaterThan(0);
    expect(parsed.issues.length).toBe(report.issues.length);
    expect(parsed.issues[0].fingerprint).toBeTruthy();
  });

  it('should keep fingerprints stable across locales', async () => {
    process.env.CODETRUST_LANG = 'en';
    resetLocaleCache();
    const englishEngine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const englishReport = await englishEngine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    process.env.CODETRUST_LANG = 'zh';
    resetLocaleCache();
    const chineseEngine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const chineseReport = await chineseEngine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    expect(chineseReport.issues.map((issue) => issue.fingerprint)).toEqual(
      englishReport.issues.map((issue) => issue.fingerprint),
    );
  });
});
