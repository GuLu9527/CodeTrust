import { Issue, RuleCategory, Severity } from '../types/index.js';

export interface Rule {
  id: string;
  category: RuleCategory;
  severity: Severity;
  title: string;
  description: string;
  check: (context: RuleContext) => Issue[];
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
