import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../../src/rules/engine.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import type { Rule } from '../../src/rules/types.js';

describe('RuleEngine diagnostics', () => {
  it('run remains compatible and returns only issues', () => {
    const engine = new RuleEngine(DEFAULT_CONFIG);
    const issues = engine.run({
      filePath: 'test.ts',
      fileContent: 'const value = 1;\nconsole.log(value);\n',
      addedLines: [],
    });

    expect(Array.isArray(issues)).toBe(true);
  });

  it('runWithDiagnostics reports counters and failures for a throwing rule', () => {
    const engine = new RuleEngine(DEFAULT_CONFIG) as RuleEngine & { rules: Rule[] };
    engine.rules = [
      {
        id: 'test/throwing-rule',
        category: 'logic',
        severity: 'medium',
        title: 'Throwing rule',
        description: 'Test-only throwing rule',
        check: () => {
          throw new Error('boom');
        },
      },
    ];

    const result = engine.runWithDiagnostics({
      filePath: 'test.ts',
      fileContent: 'const value = 1;\n',
      addedLines: [],
    });

    expect(result.rulesExecuted).toBe(1);
    expect(result.rulesFailed).toBe(1);
    expect(result.ruleFailures).toEqual([
      {
        ruleId: 'test/throwing-rule',
        file: 'test.ts',
        message: 'boom',
      },
    ]);
    expect(result.issues).toEqual([]);
  });
});
