/**
 * Utility functions for rule fix implementations.
 */

/**
 * Get the byte offset of a specific line start (1-indexed).
 */
export function lineStartOffset(content: string, lineNumber: number): number {
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
 */
export function lineRange(content: string, lineNumber: number): [number, number] {
  const lines = content.split('\n');
  const lineIndex = lineNumber - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) return [0, 0];

  const start = lineStartOffset(content, lineNumber);
  const end = start + lines[lineIndex].length + (lineIndex < lines.length - 1 ? 1 : 0);
  return [start, end];
}
