/**
 * Utility functions for rule fix implementations.
 */

/**
 * Precomputed line offset table for efficient repeated lookups.
 * Call once per file content, then pass to lineStartOffset / lineRange.
 */
export function buildLineOffsets(content: string): number[] {
  const offsets: number[] = [0]; // line 1 starts at offset 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Get the byte offset of a specific line start (1-indexed).
 * If `offsets` is provided, uses the precomputed table for O(1) lookup.
 */
export function lineStartOffset(content: string, lineNumber: number, offsets?: number[]): number {
  if (offsets) {
    const idx = lineNumber - 1;
    if (idx < 0 || idx >= offsets.length) return content.length;
    return offsets[idx];
  }

  // Fallback: compute on the fly (kept for backward compatibility)
  let offset = 0;
  const lines = content.split('\n');
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  return offset;
}

/**
 * Get the byte offset range for an entire line (1-indexed),
 * including the trailing newline if present.
 * If `offsets` is provided, uses the precomputed table.
 */
export function lineRange(content: string, lineNumber: number, offsets?: number[]): [number, number] {
  const table = offsets ?? buildLineOffsets(content);
  const lineIndex = lineNumber - 1;
  if (lineIndex < 0 || lineIndex >= table.length) return [0, 0];

  const start = table[lineIndex];
  const nextLineStart = lineIndex + 1 < table.length ? table[lineIndex + 1] : content.length;
  // Include the trailing newline if this is not the last line
  const end = lineIndex + 1 < table.length ? nextLineStart : nextLineStart;
  return [start, end];
}
