import { describe, it, expect } from 'vitest';
import { analyzeStructure } from '../../src/analyzers/structure.js';

describe('structure analyzer', () => {
  it('should detect high cyclomatic complexity', () => {
    const code = `
function complex(a: number, b: number, c: number) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        return 1;
      } else if (c < -1) {
        return 2;
      } else {
        return 3;
      }
    } else if (b < -1) {
      return 4;
    }
  } else if (a < -1) {
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        console.log(i);
      } else if (i % 3 === 0) {
        console.log(i * 2);
      }
    }
    while (b > 0) {
      b--;
      if (b === 5) break;
    }
  }
  return a || b || c ? 1 : 0;
}
`;
    const result = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 5 });
    const ccIssue = result.issues.find((i) => i.ruleId === 'structure/high-cyclomatic-complexity');
    expect(ccIssue).toBeDefined();
  });

  it('should detect long functions', () => {
    const lines = Array.from({ length: 80 }, (_, i) => `  const x${i} = ${i};`);
    const code = `function longFn() {\n${lines.join('\n')}\n}`;
    const result = analyzeStructure(code, 'test.ts', { maxFunctionLength: 60 });
    const issue = result.issues.find((i) => i.ruleId === 'structure/long-function');
    expect(issue).toBeDefined();
  });

  it('should detect deep nesting', () => {
    const code = `
function deep() {
  if (true) {
    for (let i = 0; i < 10; i++) {
      if (i > 0) {
        while (i < 5) {
          if (i === 3) {
            console.log(i);
          }
        }
      }
    }
  }
}
`;
    const result = analyzeStructure(code, 'test.ts', { maxNestingDepth: 3 });
    const issue = result.issues.find((i) => i.ruleId === 'structure/deep-nesting');
    expect(issue).toBeDefined();
  });

  it('should detect too many parameters', () => {
    const code = `
function tooMany(a: number, b: number, c: number, d: number, e: number, f: number, g: number) {
  return a + b + c + d + e + f + g;
}
`;
    const result = analyzeStructure(code, 'test.ts', { maxParamCount: 5 });
    const issue = result.issues.find((i) => i.ruleId === 'structure/too-many-params');
    expect(issue).toBeDefined();
  });

  it('should NOT flag simple functions', () => {
    const code = `
function simple(x: number): number {
  return x * 2;
}
`;
    const result = analyzeStructure(code, 'test.ts');
    expect(result.issues.length).toBe(0);
  });
});
