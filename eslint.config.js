/**
 * ESLint Configuration (Flat Config)
 * @module eslint.config
 * @version 1.0.0
 * 
 * ESLint configuration for the Sammy Chrome Extension.
 * Uses ESLint 9.x flat config format.
 * 
 * Features:
 * - TypeScript support with strict type checking
 * - React and React Hooks rules
 * - Import ordering and organization
 * - Circular dependency detection
 * - Layer boundary enforcement
 */

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

// ============================================================================
// LAYER DEFINITIONS FOR IMPORT BOUNDARIES
// ============================================================================

/**
 * Module layer definitions for dependency enforcement
 * Layer N can only import from Layer N-1 or lower
 */
const LAYER_PATTERNS = {
  // Layer 1: Foundation (no dependencies)
  foundation: [
    'src/core/types/**',
    'src/utils/**',
  ],
  
  // Layer 2: Infrastructure (depends on foundation)
  infrastructure: [
    'src/core/storage/**',
    'src/core/locators/**',
    'src/core/csv/**',
    'src/core/messages/**',
  ],
  
  // Layer 3: Core Logic (depends on infrastructure)
  coreLogic: [
    'src/core/recording/**',
    'src/core/replay/**',
    'src/background/**',
  ],
  
  // Layer 4: Coordination (depends on core logic)
  coordination: [
    'src/contentScript/**',
    'src/core/orchestrator/**',
  ],
  
  // Layer 5: Presentation (depends on coordination)
  presentation: [
    'src/pages/**',
    'src/components/**',
    'src/hooks/**',
    'src/context/**',
  ],
};

// ============================================================================
// CONFIGURATION
// ============================================================================

export default tseslint.config(
  // ==========================================================================
  // BASE CONFIGURATIONS
  // ==========================================================================
  
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  
  // ==========================================================================
  // GLOBAL SETTINGS
  // ==========================================================================
  
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        chrome: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },
  
  // ==========================================================================
  // TYPESCRIPT FILES
  // ==========================================================================
  
  {
    files: ['**/*.ts', '**/*.tsx'],
    
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import': importPlugin,
    },
    
    rules: {
      // ======================================================================
      // TYPESCRIPT RULES
      // ======================================================================
      
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      
      '@typescript-eslint/no-explicit-any': 'warn',
      
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      '@typescript-eslint/no-empty-interface': ['error', {
        allowSingleExtends: true,
      }],
      
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
      }],
      
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      
      '@typescript-eslint/no-import-type-side-effects': 'error',
      
      '@typescript-eslint/naming-convention': ['error',
        // Interfaces must start with I (optional, can be removed)
        // {
        //   selector: 'interface',
        //   format: ['PascalCase'],
        //   prefix: ['I'],
        // },
        // Types must be PascalCase
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        // Constants can be UPPER_CASE or camelCase
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        // Functions must be camelCase
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      
      // ======================================================================
      // REACT RULES
      // ======================================================================
      
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      
      'react/jsx-key': ['error', {
        checkFragmentShorthand: true,
      }],
      
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': 'error',
      'react/self-closing-comp': 'error',
      
      'react/jsx-curly-brace-presence': ['error', {
        props: 'never',
        children: 'never',
      }],
      
      'react/jsx-boolean-value': ['error', 'never'],
      
      'react/jsx-fragments': ['error', 'syntax'],
      
      'react/jsx-no-useless-fragment': ['error', {
        allowExpressions: true,
      }],
      
      // ======================================================================
      // REACT HOOKS RULES
      // ======================================================================
      
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // ======================================================================
      // IMPORT RULES
      // ======================================================================
      
      'import/no-unresolved': 'off', // TypeScript handles this
      
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'type',
        ],
        pathGroups: [
          {
            pattern: 'react',
            group: 'external',
            position: 'before',
          },
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['react', 'type'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      }],
      
      'import/no-duplicates': 'error',
      
      'import/no-cycle': ['error', {
        maxDepth: 10,
        ignoreExternal: true,
      }],
      
      'import/no-self-import': 'error',
      
      'import/no-useless-path-segments': ['error', {
        noUselessIndex: true,
      }],
      
      'import/first': 'error',
      
      'import/newline-after-import': ['error', {
        count: 1,
      }],
      
      'import/no-mutable-exports': 'error',
      
      'import/no-named-as-default': 'warn',
      
      'import/no-named-as-default-member': 'warn',
      
      // ======================================================================
      // GENERAL RULES
      // ======================================================================
      
      'no-console': ['warn', {
        allow: ['warn', 'error', 'info'],
      }],
      
      'no-debugger': 'warn',
      
      'no-alert': 'error',
      
      'no-eval': 'error',
      
      'no-implied-eval': 'error',
      
      'no-var': 'error',
      
      'prefer-const': ['error', {
        destructuring: 'all',
      }],
      
      'prefer-template': 'error',
      
      'prefer-spread': 'error',
      
      'prefer-rest-params': 'error',
      
      'prefer-arrow-callback': ['error', {
        allowNamedFunctions: true,
      }],
      
      'arrow-body-style': ['error', 'as-needed'],
      
      'no-param-reassign': ['error', {
        props: false,
      }],
      
      'no-nested-ternary': 'warn',
      
      'no-unneeded-ternary': 'error',
      
      'object-shorthand': ['error', 'always'],
      
      'eqeqeq': ['error', 'always', {
        null: 'ignore',
      }],
      
      'curly': ['error', 'multi-line'],
      
      'max-lines': ['warn', {
        max: 400,
        skipBlankLines: true,
        skipComments: true,
      }],
      
      'max-lines-per-function': ['warn', {
        max: 50,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true,
      }],
      
      'complexity': ['warn', 10],
      
      'max-depth': ['warn', 4],
      
      'max-params': ['warn', 5],
      
      'no-magic-numbers': ['warn', {
        ignore: [-1, 0, 1, 2, 100],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        enforceConst: true,
      }],
    },
  },
  
  // ==========================================================================
  // TEST FILES (RELAXED RULES)
  // ==========================================================================
  
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'src/test/**/*.ts',
      'src/test/**/*.tsx',
      'tests/**/*.ts',
      'tests/**/*.tsx',
    ],
    
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'no-magic-numbers': 'off',
    },
  },
  
  // ==========================================================================
  // CONFIG FILES
  // ==========================================================================
  
  {
    files: [
      '*.config.ts',
      '*.config.js',
      'vite.config.*.ts',
    ],
    
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  
  // ==========================================================================
  // CONTENT SCRIPTS (BROWSER GLOBALS)
  // ==========================================================================
  
  {
    files: ['src/contentScript/**/*.ts'],
    
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
    },
  },
  
  // ==========================================================================
  // BACKGROUND SCRIPTS (SERVICE WORKER)
  // ==========================================================================
  
  {
    files: ['src/background/**/*.ts'],
    
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        chrome: 'readonly',
        navigator: 'readonly',
      },
    },
  },
  
  // ==========================================================================
  // PAGE CONTEXT SCRIPTS
  // ==========================================================================
  
  {
    files: [
      'src/contentScript/page-*.ts',
    ],
    
    rules: {
      // These scripts run in page context, different rules apply
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
