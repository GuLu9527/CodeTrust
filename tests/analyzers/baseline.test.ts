import { describe, it, expect } from 'vitest';
import { calculateBaseline } from '../../src/analyzers/baseline.js';
import * as path from 'node:path';

describe('baseline calculator', () => {
  it('should calculate baseline for project src directory', () => {
    const projectDir = path.resolve(__dirname, '../../src');
    const baseline = calculateBaseline(projectDir);

    expect(baseline.totalFiles).toBeGreaterThan(0);
    expect(baseline.totalFunctions).toBeGreaterThan(0);
    expect(baseline.avgCyclomaticComplexity).toBeGreaterThan(0);
    expect(baseline.avgFunctionLength).toBeGreaterThan(0);
    expect(baseline.p90CyclomaticComplexity).toBeGreaterThanOrEqual(baseline.avgCyclomaticComplexity);
  });

  it('should return defaults for empty directory', () => {
    const baseline = calculateBaseline('/tmp/nonexistent-dir-codetrust-test');

    expect(baseline.totalFiles).toBe(0);
    expect(baseline.totalFunctions).toBe(0);
    expect(baseline.avgCyclomaticComplexity).toBe(1);
  });
});
