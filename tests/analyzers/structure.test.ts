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

  it('should NOT count nested function branches in outer function cyclomatic complexity', () => {
    // Outer function has 2 branches (if statements), nested function has 3 branches
    // Outer CC should be 3 (1 base + 2), not 6 (1 base + 5)
    const code = `
function outerWithNested(a: number, b: number) {
  if (a > 0) {
    // This nested function has its own branches
    const helper = function(x: number) {
      if (x > 0) {
        if (x > 10) {
          return x * 2;
        } else if (x < 5) {
          return x * 3;
        }
      }
      return x;
    };
    return helper(b);
  } else if (a < 0) {
    return -1;
  }
  return 0;
}
`;
    const result = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 4 });
    // Should NOT flag outer function because its CC is only 3 (1 base + 2 if branches)
    const outerIssue = result.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerWithNested')
    );
    expect(outerIssue).toBeUndefined();

    // The nested helper has CC = 4 (1 base + 3 branches), which equals threshold
    // so it should NOT be flagged (only > threshold is flagged)
    const nestedIssue = result.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerWithNested') === false
    );
    expect(nestedIssue).toBeUndefined();

    // Verify with lower threshold that nested function IS detected separately
    const result2 = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 3 });
    // Now outer (CC=3) should NOT be flagged, but nested (CC=4) should be
    const nestedIssue2 = result2.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerWithNested') === false
    );
    expect(nestedIssue2).toBeDefined();
  });

  it('should NOT count arrow function branches in outer function complexity', () => {
    // Outer function has 1 branch, nested arrow has 2 branches
    // Outer CC should be 2 (1 base + 1), not 4 (1 base + 3)
    const code = `
function outerWithArrow(items: number[]) {
  if (items.length > 0) {
    // This arrow function has its own branches
    const processed = items.map(item => {
      if (item > 0) {
        return item * 2;
      } else if (item < 0) {
        return item * -1;
      }
      return 0;
    });
    return processed;
  }
  return [];
}
`;
    const result = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 3 });
    // Should NOT flag outer function because its CC is only 2 (1 base + 1 if)
    const outerIssue = result.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerWithArrow')
    );
    expect(outerIssue).toBeUndefined();
  });

  it('should NOT count callback nesting in outer function max nesting depth', () => {
    // Outer function has nesting depth 3 (if > for > if)
    // The callback's internal if is NOT counted toward outer function
    const code = `
function outerWithCallback(data: number[]) {
  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0) {
        // This callback has its own nesting - should NOT count toward outer
        setTimeout(() => {
          if (data[i] > 100) {
            console.log('big');
          }
        }, 0);
      }
    }
  }
}
`;
    // With threshold 3, outer function (depth 3) should NOT be flagged
    const result = analyzeStructure(code, 'test.ts', { maxNestingDepth: 3 });
    const outerIssue = result.issues.find((i) =>
      i.ruleId === 'structure/deep-nesting' &&
      i.message.includes('outerWithCallback')
    );
    expect(outerIssue).toBeUndefined();

    // But with threshold 2, outer function SHOULD be flagged
    const result2 = analyzeStructure(code, 'test.ts', { maxNestingDepth: 2 });
    const outerIssue2 = result2.issues.find((i) =>
      i.ruleId === 'structure/deep-nesting' &&
      i.message.includes('outerWithCallback')
    );
    expect(outerIssue2).toBeDefined();

    // The callback itself has depth 1, so it should never be flagged
    const callbackIssue = result2.issues.find((i) =>
      i.ruleId === 'structure/deep-nesting' &&
      i.message.includes('outerWithCallback') === false
    );
    expect(callbackIssue).toBeUndefined();
  });

  it('should NOT count nested function cognitive complexity in outer function', () => {
    // Outer function: 1 if at depth 0 = +1
    // Nested function: 2 ifs at depths 0,1 = +1 + +2 = +3
    // Outer cognitive should be 1, not 4
    const code = `
function outerCognitive(x: number) {
  if (x > 0) {
    const inner = function(y: number) {
      if (y > 0) {
        if (y > 10) {
          return y * 2;
        }
      }
      return y;
    };
    return inner(x);
  }
  return 0;
}
`;
    const result = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 3 });
    // Outer CC should be 2 (1 base + 1 if), not affected by nested function
    const outerIssue = result.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerCognitive')
    );
    expect(outerIssue).toBeUndefined();
  });

  it('should handle multiple nested functions at same level', () => {
    // Outer: 1 if = CC 2
    // Nested1: 2 ifs = CC 3
    // Nested2: 1 if = CC 2
    const code = `
function outerMultiple() {
  if (true) {
    const fn1 = function() {
      if (true) {
        if (true) {
          return 1;
        }
      }
      return 0;
    };
    const fn2 = function() {
      if (true) {
        return 2;
      }
      return 0;
    };
    return fn1() + fn2();
  }
  return 0;
}
`;
    // With threshold 3: outer (CC=2) and fn2 (CC=2) should NOT be flagged
    // fn1 (CC=3) should NOT be flagged because it equals threshold
    const result = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 3 });

    // Outer should NOT be flagged (CC = 2)
    const outerIssue = result.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerMultiple')
    );
    expect(outerIssue).toBeUndefined();

    // fn1 should NOT be flagged (CC = 3, equals threshold)
    const fn1Issue = result.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerMultiple') === false
    );
    expect(fn1Issue).toBeUndefined();

    // With threshold 2: fn1 (CC=3) SHOULD be flagged
    const result2 = analyzeStructure(code, 'test.ts', { maxCyclomaticComplexity: 2 });

    // fn1 SHOULD be flagged (CC = 3 > 2)
    const fn1Issue2 = result2.issues.find((i) =>
      i.ruleId === 'structure/high-cyclomatic-complexity' &&
      i.message.includes('outerMultiple') === false
    );
    expect(fn1Issue2).toBeDefined();

    // fn2 should NOT be flagged (CC = 2, equals threshold)
    // outer should NOT be flagged (CC = 2, equals threshold)
    expect(result2.issues.filter(i => i.ruleId === 'structure/high-cyclomatic-complexity').length).toBe(1);
  });
});
