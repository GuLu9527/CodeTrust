import { describe, it, expect } from 'vitest';
import { unusedImportRule } from '../../src/rules/builtin/unused-import.js';

function check(code: string) {
  return unusedImportRule.check({
    filePath: 'test.ts',
    fileContent: code,
    addedLines: [],
  });
}

describe('logic/unused-import', () => {
  it('should detect unused named import', () => {
    const issues = check(`
import { foo, bar } from './utils';
console.log(foo);
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('bar');
  });

  it('should NOT flag used imports', () => {
    const issues = check(`
import { readFile } from 'node:fs';
const data = readFile('test.txt');
    `);
    expect(issues.length).toBe(0);
  });

  it('should detect completely unused import', () => {
    const issues = check(`
import { helper } from './helper';

function doWork() {
  return 42;
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('helper');
  });

  it('should NOT flag type imports used in type positions', () => {
    const issues = check(`
import type { Config } from './config';

const config: Config = { version: 1 };
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag namespace imports', () => {
    const issues = check(`
import * as path from 'node:path';
const dir = path.dirname('/foo/bar');
    `);
    expect(issues.length).toBe(0);
  });
});
