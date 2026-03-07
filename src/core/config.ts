import { cosmiconfig } from 'cosmiconfig';
import { CodeTrustConfig, DEFAULT_CONFIG } from '../types/config.js';

const MODULE_NAME = 'codetrust';

export async function loadConfig(searchFrom?: string): Promise<CodeTrustConfig> {
  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      `.${MODULE_NAME}.yml`,
      `.${MODULE_NAME}.yaml`,
      `.${MODULE_NAME}.json`,
      `.${MODULE_NAME}rc`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.ts`,
    ],
  });

  const result = await explorer.search(searchFrom);

  if (!result || result.isEmpty) {
    return DEFAULT_CONFIG;
  }

  return mergeConfig(DEFAULT_CONFIG, result.config);
}

function mergeConfig(
  defaults: CodeTrustConfig,
  overrides: Partial<CodeTrustConfig>,
): CodeTrustConfig {
  return {
    ...defaults,
    ...overrides,
    weights: { ...defaults.weights, ...overrides.weights },
    thresholds: { ...defaults.thresholds, ...overrides.thresholds },
    rules: {
      disabled: overrides.rules?.disabled ?? defaults.rules.disabled,
      overrides: { ...defaults.rules.overrides, ...overrides.rules?.overrides },
    },
    detection: { ...defaults.detection, ...overrides.detection },
  };
}

export function generateDefaultConfig(): string {
  return `# .codetrust.yml
version: 1

# Scan scope
include:
  - "src/**/*.ts"
  - "src/**/*.js"
exclude:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/node_modules/**"
  - "**/dist/**"

# Dimension weights (must sum to 1.0)
weights:
  security: 0.30
  logic: 0.25
  structure: 0.20
  style: 0.10
  coverage: 0.15

# Thresholds
thresholds:
  min-score: 70
  max-function-length: 40
  max-cyclomatic-complexity: 10
  max-nesting-depth: 4
  max-params: 5

# Rules
rules:
  disabled: []
  overrides: {}

# AI code detection
detection:
  enabled: true
  show-probability: true
`;
}
