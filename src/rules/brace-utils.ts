/**
 * String/comment/regex-aware brace utilities for rule implementations.
 *
 * Naive `ch === '{'` counting breaks when braces appear inside strings,
 * template literals, regular expressions, or comments.  These helpers
 * skip over such contexts so callers get accurate brace depth tracking.
 */

export interface BraceContext {
  /** Current nesting depth (0 = top-level). */
  depth: number;
  /** Index of the character *after* the last processed character. */
  endIndex: number;
}

/**
 * Walk `line` starting at `startJ`, tracking brace depth while skipping
 * characters inside strings, template literals, line comments, and
 * block-comment regions.
 *
 * @returns The updated brace depth after processing the line.
 */
export function countBracesInLine(
  line: string,
  startJ: number,
  initialDepth: number,
  inBlockComment: { value: boolean },
): number {
  let depth = initialDepth;
  let i = startJ;

  while (i < line.length) {
    // Inside a block comment — look for closing */
    if (inBlockComment.value) {
      const closeIdx = line.indexOf('*/', i);
      if (closeIdx === -1) return depth; // rest of line is comment
      inBlockComment.value = false;
      i = closeIdx + 2;
      continue;
    }

    const ch = line[i];

    // Line comment — rest of line is ignored
    if (ch === '/' && line[i + 1] === '/') return depth;

    // Block comment opening
    if (ch === '/' && line[i + 1] === '*') {
      inBlockComment.value = true;
      i += 2;
      continue;
    }

    // String literals (single-quote, double-quote)
    if (ch === "'" || ch === '"') {
      i = skipStringLiteral(line, i, ch);
      continue;
    }

    // Template literal (backtick) — simplified: skip until unescaped backtick
    if (ch === '`') {
      i = skipTemplateLiteral(line, i);
      continue;
    }

    // Regular expression literal — heuristic: `/` after `=`, `(`, `,`, `!`, `|`, `&`, `:`
    // This is a simplification; for full accuracy an AST should be used.
    if (ch === '/' && i > 0) {
      const prevNonSpace = findPrevNonSpace(line, i);
      if (prevNonSpace !== -1 && '=(!|&:,;[{?+->~%^'.includes(line[prevNonSpace])) {
        i = skipRegexpLiteral(line, i);
        continue;
      }
    }

    if (ch === '{') depth++;
    if (ch === '}') depth--;

    i++;
  }

  return depth;
}

function skipStringLiteral(line: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2; // skip escaped character
      continue;
    }
    if (line[i] === quote) return i + 1;
    i++;
  }
  return i; // unterminated — treat rest of line as inside string
}

function skipTemplateLiteral(line: string, start: number): number {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] === '`') return i + 1;
    i++;
  }
  return i;
}

function skipRegexpLiteral(line: string, start: number): number {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] === '/') return i + 1;
    i++;
  }
  return i;
}

function findPrevNonSpace(line: string, pos: number): number {
  for (let i = pos - 1; i >= 0; i--) {
    if (line[i] !== ' ' && line[i] !== '\t') return i;
  }
  return -1;
}

/**
 * Extract the body of a brace-delimited block starting from a given line and column.
 * Returns the body lines (excluding the opening/closing brace lines) and the
 * end line index.  Returns null if the block cannot be parsed.
 */
export function extractBraceBlock(
  lines: string[],
  startLineIndex: number,
  startCol: number,
): { bodyLines: string[]; endLine: number } | null {
  let depth = 0;
  let started = false;
  let bodyStart = -1;
  const blockComment = { value: false };

  for (let i = startLineIndex; i < lines.length; i++) {
    const startJ = i === startLineIndex ? startCol : 0;

    const line = lines[i];
    let j = startJ;

    // Process character by character to detect the exact brace that opens/closes
    while (j < line.length) {
      if (blockComment.value) {
        const closeIdx = line.indexOf('*/', j);
        if (closeIdx === -1) { j = line.length; continue; }
        blockComment.value = false;
        j = closeIdx + 2;
        continue;
      }

      const ch = line[j];

      if (ch === '/' && line[j + 1] === '/') break;
      if (ch === '/' && line[j + 1] === '*') {
        blockComment.value = true;
        j += 2;
        continue;
      }
      if (ch === "'" || ch === '"') {
        j = skipStringLiteral(line, j, ch);
        continue;
      }
      if (ch === '`') {
        j = skipTemplateLiteral(line, j);
        continue;
      }

      if (ch === '{') {
        depth++;
        if (!started) {
          started = true;
          bodyStart = i;
        }
      } else if (ch === '}') {
        depth--;
        if (started && depth === 0) {
          return {
            bodyLines: lines.slice(bodyStart + 1, i),
            endLine: i,
          };
        }
      }

      j++;
    }
  }

  return null;
}
