import simpleGit, { SimpleGit } from 'simple-git';
import { DiffFile, DiffHunk } from '../types/index.js';

const GIT_DIFF_UNIFIED = '--unified=3';
const SHORT_HASH_LENGTH = 7;

export class DiffParser {
  private git: SimpleGit;

  constructor(workDir?: string) {
    this.git = simpleGit(workDir);
  }

  async getStagedFiles(): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff(['--cached', GIT_DIFF_UNIFIED]);
    return this.parseDiffOutput(diffDetail);
  }

  async getDiffFromRef(ref: string): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff([ref, GIT_DIFF_UNIFIED]);
    return this.parseDiffOutput(diffDetail);
  }

  async getChangedFiles(): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff([GIT_DIFF_UNIFIED]);
    const stagedDetail = await this.git.diff(['--cached', GIT_DIFF_UNIFIED]);

    // Parse unstaged and staged diffs separately, then merge to avoid duplicates
    const unstagedFiles = this.parseDiffOutput(diffDetail);
    const stagedFiles = this.parseDiffOutput(stagedDetail);

    return this.mergeDiffFiles(unstagedFiles, stagedFiles);
  }

  /**
   * Merge two sets of diff files, deduplicating by file path.
   * When a file appears in both, merge their hunks and combine stats.
   */
  private mergeDiffFiles(unstaged: DiffFile[], staged: DiffFile[]): DiffFile[] {
    const fileMap = new Map<string, DiffFile>();

    // Add unstaged files first
    for (const file of unstaged) {
      fileMap.set(file.filePath, file);
    }

    // Merge or add staged files
    for (const file of staged) {
      const existing = fileMap.get(file.filePath);
      if (existing) {
        // File exists in both: merge hunks and combine stats
        fileMap.set(file.filePath, {
          ...existing,
          // Combine additions/deletions
          additions: existing.additions + file.additions,
          deletions: existing.deletions + file.deletions,
          // Merge hunks (preserve order: staged first, then unstaged)
          hunks: [...file.hunks, ...existing.hunks],
          // Status: if either is 'added', treat as added; otherwise keep modified
          status: existing.status === 'added' || file.status === 'added' ? 'added' : 'modified',
        });
      } else {
        fileMap.set(file.filePath, file);
      }
    }

    return Array.from(fileMap.values());
  }

  async getLastCommitDiff(): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff(['HEAD~1', 'HEAD', GIT_DIFF_UNIFIED]);
    return this.parseDiffOutput(diffDetail);
  }

  async getCurrentCommitHash(): Promise<string | undefined> {
    try {
      const hash = await this.git.revparse(['HEAD']);
      return hash.trim().slice(0, SHORT_HASH_LENGTH);
    } catch {
      return undefined;
    }
  }

  async getFileContent(filePath: string): Promise<string | undefined> {
    try {
      const content = await this.git.show([`HEAD:${filePath}`]);
      return content;
    } catch {
      return undefined;
    }
  }

  private parseDiffOutput(diffOutput: string): DiffFile[] {
    const files: DiffFile[] = [];
    const fileDiffs = diffOutput.split(/^diff --git /m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
      const file = this.parseFileDiff(fileDiff);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  private parseFileDiff(fileDiff: string): DiffFile | null {
    const lines = fileDiff.split('\n');

    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) return null;

    const filePath = headerMatch[2];
    let status: DiffFile['status'] = 'modified';
    let additions = 0;
    let deletions = 0;

    if (fileDiff.includes('new file mode')) {
      status = 'added';
    } else if (fileDiff.includes('deleted file mode')) {
      status = 'deleted';
    } else if (fileDiff.includes('rename from')) {
      status = 'renamed';
    }

    const hunks = this.parseHunks(fileDiff);

    for (const line of fileDiff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      filePath,
      status,
      additions,
      deletions,
      hunks,
    };
  }

  private parseHunks(fileDiff: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)$/gm;
    let match: RegExpExecArray | null;

    const lines = fileDiff.split('\n');

    while ((match = hunkRegex.exec(fileDiff)) !== null) {
      const oldStart = parseInt(match[1], 10);
      const oldLines = parseInt(match[2] || '1', 10);
      const newStart = parseInt(match[3], 10);
      const newLines = parseInt(match[4] || '1', 10);

      const hunkStartIndex = lines.findIndex((l) => l.includes(match![0]));
      const hunkContent: string[] = [];

      if (hunkStartIndex >= 0) {
        for (let i = hunkStartIndex + 1; i < lines.length; i++) {
          if (lines[i].startsWith('@@ ') || lines[i].startsWith('diff --git ')) {
            break;
          }
          hunkContent.push(lines[i]);
        }
      }

      hunks.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        content: hunkContent.join('\n'),
      });
    }

    return hunks;
  }
}
