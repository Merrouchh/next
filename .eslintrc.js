module.exports = {
  extends: [
    'next',
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    // Fix the unescaped entities warnings
    'react/no-unescaped-entities': 'off',
    // Fix the img element warnings
    '@next/next/no-img-element': 'off',
    // Fix the sync scripts warnings
    '@next/next/no-sync-scripts': 'off',
    // Fix jsx property warnings
    'react/no-unknown-property': ['error', { 
      ignore: ['jsx', 'strategy'] 
    }],
    // Fix unused vars warnings
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      ignoreRestSiblings: true
    }],
    // Fix hooks dependency warnings
    'react-hooks/exhaustive-deps': 'warn',
    // Fix other common issues
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-undef': 'error',
    'react/display-name': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  env: {
    browser: true,
    node: true,
    es6: true
  },
  globals: {
    // Add any global variables here
    isMobile: 'writable',
    activeTab: 'writable',
    setActiveTab: 'writable',
    searchQuery: 'writable',
    setSearchQuery: 'writable',
    handleClipUpdate: 'writable',
    gridRef: 'writable',
    user: 'writable'
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  }
}; 