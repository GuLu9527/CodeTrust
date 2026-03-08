import { Issue } from '../types/index.js';
import { CodeTrustConfig } from '../types/config.js';
import { Rule, RuleContext } from './types.js';
import { unnecessaryTryCatchRule } from './builtin/unnecessary-try-catch.js';
import { overDefensiveRule } from './builtin/over-defensive.js';
import { deadLogicRule } from './builtin/dead-logic.js';
import { unusedVariablesRule } from './builtin/unused-variables.js';
import { duplicateConditionRule } from './builtin/duplicate-condition.js';
import { securityRules } from './builtin/security.js';
import { emptyCatchRule } from './builtin/empty-catch.js';
import { identicalBranchesRule } from './builtin/identical-branches.js';
import { redundantElseRule } from './builtin/redundant-else.js';
import { consoleInCodeRule } from './builtin/console-in-code.js';
import { phantomImportRule } from './builtin/phantom-import.js';
import { unusedImportRule } from './builtin/unused-import.js';
import { missingAwaitRule } from './builtin/missing-await.js';
import { anyTypeAbuseRule } from './builtin/any-type-abuse.js';
import { typeCoercionRule } from './builtin/type-coercion.js';
import { magicNumberRule } from './builtin/magic-number.js';
import { nestedTernaryRule } from './builtin/nested-ternary.js';
import { duplicateStringRule } from './builtin/duplicate-string.js';
import { noDebuggerRule } from './builtin/no-debugger.js';
import { noNonNullAssertionRule } from './builtin/no-non-null-assertion.js';
import { noSelfCompareRule } from './builtin/no-self-compare.js';
import { noReturnAssignRule } from './builtin/no-return-assign.js';
import { promiseVoidRule } from './builtin/promise-void.js';
import { noReassignParamRule } from './builtin/no-reassign-param.js';
import { noAsyncWithoutAwaitRule } from './builtin/no-async-without-await.js';
import { noUselessConstructorRule } from './builtin/no-useless-constructor.js';

const BUILTIN_RULES: Rule[] = [
  unnecessaryTryCatchRule,
  overDefensiveRule,
  deadLogicRule,
  unusedVariablesRule,
  duplicateConditionRule,
  ...securityRules,
  emptyCatchRule,
  identicalBranchesRule,
  redundantElseRule,
  consoleInCodeRule,
  phantomImportRule,
  unusedImportRule,
  missingAwaitRule,
  anyTypeAbuseRule,
  typeCoercionRule,
  magicNumberRule,
  nestedTernaryRule,
  duplicateStringRule,
  noDebuggerRule,
  noNonNullAssertionRule,
  noSelfCompareRule,
  noReturnAssignRule,
  promiseVoidRule,
  noReassignParamRule,
  noAsyncWithoutAwaitRule,
  noUselessConstructorRule,
];

export class RuleEngine {
  private rules: Rule[];

  constructor(config: CodeTrustConfig) {
    this.rules = BUILTIN_RULES.filter(
      (rule) => !config.rules.disabled.includes(rule.id),
    );
  }

  run(context: RuleContext): Issue[] {
    const allIssues: Issue[] = [];

    for (const rule of this.rules) {
      try {
        const issues = rule.check(context);
        allIssues.push(...issues);
      } catch (_err) {
        // Rule execution failed — skip silently for now
      }
    }

    return allIssues;
  }

  getRules(): Rule[] {
    return [...this.rules];
  }

  listRules(): Array<{ id: string; category: string; severity: string; title: string }> {
    return BUILTIN_RULES.map((r) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      title: r.title,
    }));
  }
}
