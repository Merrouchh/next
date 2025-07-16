#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Analyzing bundle size...\n');

try {
  // Check if @next/bundle-analyzer is installed
  const packageJson = require('../package.json');
  const hasAnalyzer = packageJson.devDependencies?.['@next/bundle-analyzer'] || 
                     packageJson.dependencies?.['@next/bundle-analyzer'];
  
  if (!hasAnalyzer) {
    console.log('📦 Installing @next/bundle-analyzer...');
    try {
      execSync('npm install --save-dev @next/bundle-analyzer', { stdio: 'inherit' });
    } catch (installError) {
      console.error('❌ Failed to install @next/bundle-analyzer:', installError.message);
      console.log('💡 You can install it manually: npm install --save-dev @next/bundle-analyzer');
      process.exit(1);
    }
  }

  // Build the project with bundle analyzer
  console.log('🏗️  Building project with bundle analysis...');
  const env = { ...process.env, ANALYZE: 'true' };
  
  try {
    execSync('npm run build', { stdio: 'inherit', env });
    console.log('\n✅ Bundle analysis complete!');
    console.log('📊 Check the generated HTML files for detailed analysis.');
  } catch (buildError) {
    console.error('❌ Build failed:', buildError.message);
    console.log('💡 Try running without analysis: npm run build');
    process.exit(1);
  }

  console.log('💡 Performance recommendations:');
  console.log('   - Look for large chunks that can be code-split');
  console.log('   - Identify unused dependencies');
  console.log('   - Check for duplicate modules');
  console.log('   - Consider lazy loading for non-critical features');

} catch (error) {
  console.error('❌ Error analyzing bundle:', error.message);
  console.log('💡 Make sure your project builds successfully first: npm run build');
  process.exit(1);
} 