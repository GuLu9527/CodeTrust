import simpleGit, { SimpleGit } from 'simple-git';
import { DiffFile, DiffHunk } from '../types/index.js';

export class DiffParser {
  private git: SimpleGit;

  constructor(workDir?: string) {
    this.git = simpleGit(workDir);
  }

  async getStagedFiles(): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff(['--cached', '--unified=3']);
    return this.parseDiffOutput(diffDetail);
  }

  async getDiffFromRef(ref: string): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff([ref, '--unified=3']);
    return this.parseDiffOutput(diffDetail);
  }

  async getChangedFiles(): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff(['--unified=3']);
    const stagedDetail = await this.git.diff(['--cached', '--unified=3']);
    const allDiff = diffDetail + '\n' + stagedDetail;
    return this.parseDiffOutput(allDiff);
  }

  async getLastCommitDiff(): Promise<DiffFile[]> {
    const diffDetail = await this.git.diff(['HEAD~1', 'HEAD', '--unified=3']);
    return this.parseDiffOutput(diffDetail);
  }

  async getCurrentCommitHash(): Promise<string | undefined> {
    try {
      const hash = await this.git.revparse(['HEAD']);
      return hash.trim().slice(0, 7);
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
