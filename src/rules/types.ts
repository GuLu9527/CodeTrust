import { Issue, RuleCategory, Severity } from '../types/index.js';

export interface Fix {
  /** Byte range in the original file content [startOffset, endOffset) */
  range: [number, number];
  /** Replacement text (empty string = delete) */
  text: string;
}

export interface Rule {
  id: string;
  category: RuleCategory;
  severity: Severity;
  title: string;
  description: string;
  check: (context: RuleContext) => Issue[];
  /** Whether this rule supports auto-fix */
  fixable?: boolean;
  /** Generate a fix for a given issue. Returns null if unfixable. */
  fix?: (context: RuleContext, issue: Issue) => Fix | null;
}

export interface RuleContext {
  filePath: string;
  fileContent: string;
  addedLines: AddedLine[];
}

export interface AddedLine {
  lineNumber: number;
  content: string;
}
