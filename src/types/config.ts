export interface CodeTrustConfig {
  version: number;
  include: string[];
  exclude: string[];
  weights: DimensionWeights;
  thresholds: Thresholds;
  rules: RulesConfig;
  detection: DetectionConfig;
}

export interface DimensionWeights {
  security: number;
  logic: number;
  structure: number;
  style: number;
  coverage: number;
}

export interface Thresholds {
  'min-score': number;
  'max-function-length': number;
  'max-cyclomatic-complexity': number;
  'max-cognitive-complexity': number;
  'max-nesting-depth': number;
  'max-params': number;
}

export interface RulesConfig {
  disabled: string[];
  overrides: Record<string, string>;
}

// Reserved for Phase 3: AI-generated code probability detection
export interface DetectionConfig {
  enabled: boolean;
  'show-probability': boolean;
}

export const DEFAULT_CONFIG: CodeTrustConfig = {
  version: 1,
  include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  exclude: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],
  weights: {
    security: 0.30,
    logic: 0.25,
    structure: 0.20,
    style: 0.10,
    coverage: 0.15,
  },
  thresholds: {
    'min-score': 70,
    'max-function-length': 40,
    'max-cyclomatic-complexity': 10,
    'max-cognitive-complexity': 20,
    'max-nesting-depth': 4,
    'max-params': 5,
  },
  rules: {
    disabled: [],
    overrides: {},
  },
  detection: {
    enabled: true,
    'show-probability': true,
  },
};
