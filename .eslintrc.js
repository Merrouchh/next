module.exports = {
  extends: [
    'next',
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'off',
    'react/no-unknown-property': ['error', { ignore: ['jsx', 'webkit-playsinline'] }],
    'react/no-unescaped-entities': 'off',
    '@next/next/no-img-element': 'off',
    'no-extra-semi': 'off',
    'no-useless-catch': 'off',
    'react-hooks/rules-of-hooks': 'error'
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['next/babel']
    },
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      modules: true,
      experimentalObjectRestSpread: true
    }
  },
  env: {
    browser: true,
    node: true,
    es6: true,
    jest: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  globals: {
    Promise: 'readonly',
    Map: 'readonly',
    Uint8Array: 'readonly'
  }
}; 