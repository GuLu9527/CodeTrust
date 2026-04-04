import { describe, it, expect, afterEach } from 'vitest';
import { ScanEngine } from '../../src/core/engine.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import { renderJsonReport } from '../../src/cli/output/json.js';
import { RuleEngine } from '../../src/rules/engine.js';
import { resetLocaleCache } from '../../src/i18n/index.js';
import type { RuleRunResult, TrustReport } from '../../src/types/index.js';
import * as path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const defaultConfig = DEFAULT_CONFIG;

const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.CODETRUST_LANG;
  resetLocaleCache();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createBaselineFile(report: Partial<TrustReport>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'codetrust-baseline-'));
  tempDirs.push(dir);
  const baselinePath = path.join(dir, 'baseline.json');
  await writeFile(baselinePath, JSON.stringify(report, null, 2), 'utf-8');
  return baselinePath;
}

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
    expect(report.dimensions.logic.score).toBeLessThan(70);
    expect(report.dimensions.security.score).toBe(100);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.issues.every((issue) => issue.fingerprint.length > 0)).toBe(true);
    expect(report.issues.every((issue) => issue.fingerprintVersion === '2')).toBe(true);
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

  it('should not add lifecycle metadata when no baseline is provided', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });

    expect(report.lifecycle).toBeUndefined();
    expect(report.fixedIssues).toEqual([]);
    expect(report.issues.every((issue) => issue.lifecycle === undefined)).toBe(true);
  });

  it('should classify all current issues as new against an empty baseline', async () => {
    const baselinePath = await createBaselineFile({
      issues: [],
      timestamp: '2026-03-16T00:00:00.000Z',
      commit: 'baseline-empty',
    });
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
      baseline: baselinePath,
    });

    expect(report.lifecycle).toEqual({
      newIssues: report.issues.length,
      existingIssues: 0,
      fixedIssues: 0,
      baselineUsed: true,
      baselineCommit: 'baseline-empty',
      baselineTimestamp: '2026-03-16T00:00:00.000Z',
    });
    expect(report.issues.every((issue) => issue.lifecycle === 'new')).toBe(true);
    expect(report.fixedIssues).toEqual([]);
  });

  it('should classify matching findings as existing with no fixed issues', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const initialReport = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });
    const baselinePath = await createBaselineFile(initialReport);

    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
      baseline: baselinePath,
    });

    expect(report.lifecycle?.newIssues).toBe(0);
    expect(report.lifecycle?.existingIssues).toBe(report.issues.length);
    expect(report.lifecycle?.fixedIssues).toBe(0);
    expect(report.issues.every((issue) => issue.lifecycle === 'existing')).toBe(true);
    expect(report.fixedIssues).toEqual([]);
  });

  it('should report mixed new existing and fixed findings', async () => {
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));
    const baselineReport = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
    });
    const retainedIssue = baselineReport.issues[0];
    const fixedIssue = {
      ...baselineReport.issues[1],
      fingerprint: 'fixed-fingerprint-only-in-baseline',
    };
    const baselinePath = await createBaselineFile({
      commit: 'baseline-mixed',
      timestamp: '2026-03-16T12:00:00.000Z',
      issues: [retainedIssue, fixedIssue],
    });

    const report = await engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
      baseline: baselinePath,
    });

    expect(report.lifecycle?.existingIssues).toBe(1);
    expect(report.lifecycle?.newIssues).toBe(report.issues.length - 1);
    expect(report.lifecycle?.fixedIssues).toBe(1);
    expect(report.lifecycle?.baselineUsed).toBe(true);
    expect(report.lifecycle?.baselineCommit).toBe('baseline-mixed');
    expect(report.lifecycle?.baselineTimestamp).toBe('2026-03-16T12:00:00.000Z');
    expect(report.issues.filter((issue) => issue.lifecycle === 'existing')).toHaveLength(1);
    expect(report.issues.filter((issue) => issue.lifecycle === 'new').length).toBeGreaterThan(0);
    expect(report.fixedIssues).toEqual([
      {
        ruleId: fixedIssue.ruleId,
        severity: fixedIssue.severity,
        category: fixedIssue.category,
        file: fixedIssue.file,
        startLine: fixedIssue.startLine,
        endLine: fixedIssue.endLine,
        message: fixedIssue.message,
        fingerprint: fixedIssue.fingerprint,
        fingerprintVersion: fixedIssue.fingerprintVersion,
      },
    ]);
  });

  it('should fail when the baseline report cannot be parsed', async () => {
    const baselinePath = await createBaselineFile({ issues: [] });
    await writeFile(baselinePath, '{not-json', 'utf-8');
    const engine = new ScanEngine(defaultConfig, path.resolve(__dirname, '../..'));

    await expect(engine.scan({
      files: ['tests/fixtures/test-ai-code.ts'],
      baseline: baselinePath,
    })).rejects.toThrow();
  });
});
