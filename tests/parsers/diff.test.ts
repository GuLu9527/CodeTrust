import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiffParser } from '../../src/parsers/diff.js';
import type { SimpleGit } from 'simple-git';

// Mock simple-git
vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGit),
}));

let mockGit: SimpleGit;

describe('DiffParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGit = {
      diff: vi.fn(),
      revparse: vi.fn(),
      show: vi.fn(),
    } as unknown as SimpleGit;
  });

  describe('getChangedFiles', () => {
    it('should deduplicate files appearing in both staged and unstaged diffs', async () => {
      const parser = new DiffParser('/test');

      // Unstaged diff for file.ts
      const unstagedDiff = `diff --git a/file.ts b/file.ts
index 1234..5678 100644
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,4 @@
 function foo() {
   console.log('unstaged');
+  const x = 1;
 }
`;

      // Staged diff for the same file.ts
      const stagedDiff = `diff --git a/file.ts b/file.ts
index 1234..5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,6 @@
 function bar() {
   return 1;
+  const y = 2;
 }
`;

      // Mock the diff calls
      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockImplementation(async (args: string[]) => {
        if (args.includes('--cached')) {
          return stagedDiff;
        }
        return unstagedDiff;
      });

      const files = await parser.getChangedFiles();

      // Should return only one file, not two
      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('file.ts');
      // Should combine additions from both diffs
      expect(files[0].additions).toBe(2);
      // Should combine hunks from both diffs
      expect(files[0].hunks.length).toBe(2);
    });

    it('should handle files only in unstaged diff', async () => {
      const parser = new DiffParser('/test');

      const unstagedDiff = `diff --git a/unstaged.ts b/unstaged.ts
index 1234..5678 100644
--- a/unstaged.ts
+++ b/unstaged.ts
@@ -1,3 +1,4 @@
 function foo() {
+  console.log('new');
   return 1;
 }
`;

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockImplementation(async (args: string[]) => {
        if (args.includes('--cached')) {
          return ''; // No staged changes
        }
        return unstagedDiff;
      });

      const files = await parser.getChangedFiles();

      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('unstaged.ts');
      expect(files[0].additions).toBe(1);
    });

    it('should handle files only in staged diff', async () => {
      const parser = new DiffParser('/test');

      const stagedDiff = `diff --git a/staged.ts b/staged.ts
index 1234..5678 100644
--- a/staged.ts
+++ b/staged.ts
@@ -1,3 +1,4 @@
 function bar() {
+  console.log('staged');
   return 2;
 }
`;

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockImplementation(async (args: string[]) => {
        if (args.includes('--cached')) {
          return stagedDiff;
        }
        return ''; // No unstaged changes
      });

      const files = await parser.getChangedFiles();

      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('staged.ts');
      expect(files[0].additions).toBe(1);
    });

    it('should handle multiple files across staged and unstaged', async () => {
      const parser = new DiffParser('/test');

      const unstagedDiff = `diff --git a/fileA.ts b/fileA.ts
index 1234..5678 100644
--- a/fileA.ts
+++ b/fileA.ts
@@ -1,3 +1,4 @@
 function a() {
+  console.log('a');
   return 1;
 }
diff --git a/shared.ts b/shared.ts
index 1234..5678 100644
--- a/shared.ts
+++ b/shared.ts
@@ -1,3 +1,4 @@
 function shared() {
+  console.log('unstaged');
   return 3;
 }
`;

      const stagedDiff = `diff --git a/fileB.ts b/fileB.ts
index 1234..5678 100644
--- a/fileB.ts
+++ b/fileB.ts
@@ -1,3 +1,4 @@
 function b() {
+  console.log('b');
   return 2;
 }
diff --git a/shared.ts b/shared.ts
index 1234..5678 100644
--- a/shared.ts
+++ b/shared.ts
@@ -5,3 +5,4 @@
 function other() {
+  console.log('staged');
   return 4;
 }
`;

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockImplementation(async (args: string[]) => {
        if (args.includes('--cached')) {
          return stagedDiff;
        }
        return unstagedDiff;
      });

      const files = await parser.getChangedFiles();

      // Should have 3 unique files: fileA.ts, fileB.ts, shared.ts
      expect(files.length).toBe(3);

      const fileMap = new Map(files.map(f => [f.filePath, f]));

      // fileA only in unstaged
      expect(fileMap.get('fileA.ts')?.additions).toBe(1);

      // fileB only in staged
      expect(fileMap.get('fileB.ts')?.additions).toBe(1);

      // shared in both: should have combined additions
      const sharedFile = fileMap.get('shared.ts');
      expect(sharedFile?.additions).toBe(2);
      expect(sharedFile?.hunks.length).toBe(2);
    });

    it('should preserve added status when merging', async () => {
      const parser = new DiffParser('/test');

      const unstagedDiff = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000..5678
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,3 @@
+function newFunc() {
+  return 1;
+}
`;

      const stagedDiff = `diff --git a/newfile.ts b/newfile.ts
index 1234..5678 100644
--- a/newfile.ts
+++ b/newfile.ts
@@ -1,3 +1,4 @@
 function newFunc() {
+  console.log('added');
   return 1;
 }
`;

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockImplementation(async (args: string[]) => {
        if (args.includes('--cached')) {
          return stagedDiff;
        }
        return unstagedDiff;
      });

      const files = await parser.getChangedFiles();

      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('newfile.ts');
      // If either diff shows 'added', the merged result should be 'added'
      expect(files[0].status).toBe('added');
    });

    it('should return empty array when no changes', async () => {
      const parser = new DiffParser('/test');

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockResolvedValue('');

      const files = await parser.getChangedFiles();

      expect(files.length).toBe(0);
    });
  });

  describe('getStagedFiles', () => {
    it('should return staged files', async () => {
      const parser = new DiffParser('/test');

      const stagedDiff = `diff --git a/staged.ts b/staged.ts
index 1234..5678 100644
--- a/staged.ts
+++ b/staged.ts
@@ -1,3 +1,4 @@
 function foo() {
+  console.log('staged');
   return 1;
 }
`;

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockResolvedValue(stagedDiff);

      const files = await parser.getStagedFiles();

      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('staged.ts');
    });
  });

  describe('getDiffFromRef', () => {
    it('should return diff from reference', async () => {
      const parser = new DiffParser('/test');

      const diffFromRef = `diff --git a/file.ts b/file.ts
index 1234..5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 function foo() {
+  console.log('from ref');
   return 1;
 }
`;

      (parser as unknown as { git: SimpleGit }).git = mockGit;
      vi.mocked(mockGit.diff).mockResolvedValue(diffFromRef);

      const files = await parser.getDiffFromRef('HEAD~1');

      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('file.ts');
    });
  });
});
