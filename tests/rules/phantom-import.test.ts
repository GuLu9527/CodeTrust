import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { phantomImportRule } from '../../src/rules/builtin/phantom-import.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_DIR = resolve(__dirname, '../__fixtures__/phantom-import-test');
const EXISTING_FILE = resolve(TEST_DIR, 'existing-module.ts');
const TEST_FILE = resolve(TEST_DIR, 'test-file.ts');

describe('logic/phantom-import', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(EXISTING_FILE, 'export const foo = 1;\n');
    // Create an index file in a subdirectory
    mkdirSync(resolve(TEST_DIR, 'utils'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'utils/index.ts'), 'export const bar = 2;\n');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should detect import from non-existent relative path', () => {
    const code = `import { foo } from './non-existent-module';`;
    const issues = phantomImportRule.check({
      filePath: TEST_FILE,
      fileContent: code,
      addedLines: [],
    });
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/phantom-import');
    expect(issues[0].severity).toBe('high');
    expect(issues[0].message).toContain('non-existent-module');
  });

  it('should NOT flag import from existing relative path', () => {
    const code = `import { foo } from './existing-module';`;
    const issues = phantomImportRule.check({
      filePath: TEST_FILE,
      fileContent: code,
      addedLines: [],
    });
    expect(issues.length).toBe(0);
  });

  it('should NOT flag import from existing directory with index file', () => {
    const code = `import { bar } from './utils';`;
    const issues = phantomImportRule.check({
      filePath: TEST_FILE,
      fileContent: code,
      addedLines: [],
    });
    expect(issues.length).toBe(0);
  });

  it('should NOT flag npm package imports (non-relative)', () => {
    const code = `import { useState } from 'react';\nimport express from 'express';`;
    const issues = phantomImportRule.check({
      filePath: TEST_FILE,
      fileContent: code,
      addedLines: [],
    });
    expect(issues.length).toBe(0);
  });

  it('should detect require with non-existent path', () => {
    const code = `const helper = require('./phantom-helper');`;
    const issues = phantomImportRule.check({
      filePath: TEST_FILE,
      fileContent: code,
      addedLines: [],
    });
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('phantom-helper');
  });
});
