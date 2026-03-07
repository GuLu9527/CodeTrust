import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects common security issues in code:
 * - Hardcoded secrets/API keys
 * - eval() usage
 * - SQL injection patterns
 * - Insecure crypto usage
 * - Dangerous innerHTML/outerHTML
 */
export const securityRules: Rule[] = [
  {
    id: 'security/hardcoded-secret',
    category: 'security',
    severity: 'high',
    title: 'Hardcoded secret or API key',
    description: 'Hardcoded secrets, API keys, passwords, or tokens in source code.',

    check(context: RuleContext): Issue[] {
      const issues: Issue[] = [];
      const lines = context.fileContent.split('\n');

      const secretPatterns = [
        // API keys / tokens
        { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i, label: 'API key' },
        { pattern: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i, label: 'secret/password' },
        // AWS
        { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key' },
        // GitHub
        { pattern: /gh[ps]_[A-Za-z0-9_]{36,}/i, label: 'GitHub Token' },
        // Generic long hex/base64 strings assigned to key-like variables
        { pattern: /(?:key|secret|token|auth)\s*[:=]\s*['"`][A-Fa-f0-9]{32,}['"`]/i, label: 'hex secret' },
        // Private key
        { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: 'private key' },
        // JWT
        { pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, label: 'JWT token' },
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments and imports
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) continue;
        // Skip env variable references
        if (/process\.env\b/.test(line)) continue;

        for (const { pattern, label } of secretPatterns) {
          if (pattern.test(line)) {
            issues.push({
              ruleId: 'security/hardcoded-secret',
              severity: 'high',
              category: 'security',
              file: context.filePath,
              startLine: i + 1,
              endLine: i + 1,
              message: t(
                `Possible hardcoded ${label} detected. Never commit secrets to source code.`,
                `检测到可能的硬编码${label}。永远不要将密钥提交到源代码中。`,
              ),
              suggestion: t(
                'Use environment variables or a secrets manager instead.',
                '请改用环境变量或密钥管理服务。',
              ),
            });
            break; // one issue per line
          }
        }
      }

      return issues;
    },
  },

  {
    id: 'security/eval-usage',
    category: 'security',
    severity: 'high',
    title: 'Dangerous eval() usage',
    description: 'eval() can execute arbitrary code and is a major security risk.',

    check(context: RuleContext): Issue[] {
      const issues: Issue[] = [];
      const lines = context.fileContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        // eval(), new Function(), setTimeout/setInterval with string
        const evalPatterns = [
          { pattern: /\beval\s*\(/, label: 'eval()' },
          { pattern: /new\s+Function\s*\(/, label: 'new Function()' },
          { pattern: /\b(setTimeout|setInterval)\s*\(\s*['"`]/, label: 'setTimeout/setInterval with string' },
        ];

        for (const { pattern, label } of evalPatterns) {
          if (pattern.test(lines[i])) {
            issues.push({
              ruleId: 'security/eval-usage',
              severity: 'high',
              category: 'security',
              file: context.filePath,
              startLine: i + 1,
              endLine: i + 1,
              message: t(
                `Dangerous ${label} detected — can execute arbitrary code.`,
                `检测到危险的 ${label} — 可执行任意代码。`,
              ),
              suggestion: t(
                `Avoid ${label}. Use safer alternatives like JSON.parse() or proper function references.`,
                `避免使用 ${label}。使用更安全的替代方案，如 JSON.parse() 或函数引用。`,
              ),
            });
            break;
          }
        }
      }

      return issues;
    },
  },

  {
    id: 'security/sql-injection',
    category: 'security',
    severity: 'high',
    title: 'Potential SQL injection',
    description: 'String concatenation or template literals in SQL queries can lead to SQL injection.',

    check(context: RuleContext): Issue[] {
      const issues: Issue[] = [];
      const lines = context.fileContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        // SQL query with string concatenation or template literal with variable
        const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/i;
        if (sqlKeywords.test(lines[i])) {
          // Check for string concat or template with variables
          if (/\$\{[^}]+\}/.test(lines[i]) || /['"]\s*\+\s*\w+/.test(lines[i])) {
            issues.push({
              ruleId: 'security/sql-injection',
              severity: 'high',
              category: 'security',
              file: context.filePath,
              startLine: i + 1,
              endLine: i + 1,
              message: t(
                'Potential SQL injection — string interpolation in SQL query.',
                '潜在的 SQL 注入 — SQL 查询中使用了字符串插值。',
              ),
              suggestion: t(
                'Use parameterized queries or prepared statements instead.',
                '请改用参数化查询或预编译语句。',
              ),
            });
          }
        }
      }

      return issues;
    },
  },

  {
    id: 'security/dangerous-html',
    category: 'security',
    severity: 'medium',
    title: 'Dangerous HTML manipulation',
    description: 'Direct innerHTML/outerHTML assignment can lead to XSS attacks.',

    check(context: RuleContext): Issue[] {
      const issues: Issue[] = [];
      const lines = context.fileContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        if (/\.(innerHTML|outerHTML)\s*=/.test(lines[i]) || /dangerouslySetInnerHTML/.test(lines[i])) {
          issues.push({
            ruleId: 'security/dangerous-html',
            severity: 'medium',
            category: 'security',
            file: context.filePath,
            startLine: i + 1,
            endLine: i + 1,
            message: t(
              'Direct HTML assignment detected — potential XSS vulnerability.',
              '检测到直接 HTML 赋值 — 可能存在 XSS 漏洞。',
            ),
            suggestion: t(
              'Use safe DOM APIs like textContent, or sanitize HTML before insertion.',
              '使用安全的 DOM API（如 textContent），或在插入前对 HTML 进行清洗。',
            ),
          });
        }
      }

      return issues;
    },
  },
];
