#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up development environment...\n');

// Check if .env.local exists
if (!fs.existsSync('.env.local')) {
  console.log('⚠️  .env.local not found');
  if (fs.existsSync('env.example')) {
    console.log('📋 Copying env.example to .env.local...');
    fs.copyFileSync('env.example', '.env.local');
    console.log('✅ .env.local created! Please update it with your actual values.\n');
  } else {
    console.log('❌ env.example not found. Please create .env.local manually.\n');
  }
} else {
  console.log('✅ .env.local exists\n');
}

// Check Node.js version
const nodeVersion = process.version;
const requiredVersion = '18.0.0';
console.log(`📋 Node.js version: ${nodeVersion}`);
if (nodeVersion < `v${requiredVersion}`) {
  console.log(`⚠️  Node.js ${requiredVersion} or higher is recommended`);
} else {
  console.log('✅ Node.js version is compatible\n');
}

// Check if critical dependencies are installed
console.log('📦 Checking dependencies...');
try {
  execSync('npm list next react react-dom', { stdio: 'pipe' });
  console.log('✅ Core dependencies are installed\n');
} catch (error) {
  console.log('⚠️  Some dependencies may be missing. Running npm install...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');
}

// Clean build artifacts
console.log('🧹 Cleaning build artifacts...');
try {
  execSync('npm run clean', { stdio: 'pipe' });
  console.log('✅ Build artifacts cleaned\n');
} catch (error) {
  console.log('⚠️  Clean command failed, continuing...\n');
}

// Type check
console.log('🔍 Running type check...');
try {
  execSync('npm run type-check', { stdio: 'pipe' });
  console.log('✅ Type check passed\n');
} catch (error) {
  console.log('⚠️  Type check failed. You may have TypeScript errors to fix.\n');
}

// Lint check
console.log('🔍 Running lint check...');
try {
  execSync('npm run lint', { stdio: 'pipe' });
  console.log('✅ Lint check passed\n');
} catch (error) {
  console.log('⚠️  Lint check failed. Run "npm run lint:fix" to fix some issues automatically.\n');
}

console.log('🎉 Development environment setup complete!');
console.log('\n📝 Next steps:');
console.log('1. Update .env.local with your actual environment variables');
console.log('2. Run "npm run dev" to start the development server');
console.log('3. Run "npm run lint:fix" if there were linting issues');
console.log('4. Check the README-FIXES.md for additional information\n'); 