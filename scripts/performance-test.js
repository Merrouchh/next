#!/usr/bin/env node
const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

console.log('🚀 Performance Testing Script\n');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const TEST_PAGES = [
  '/',
  '/events',
  '/topusers',
  '/discover',
  '/shop'
];

// Function to measure page load time
function measurePageLoad(url) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const end = performance.now();
        const loadTime = end - start;
        
        resolve({
          url,
          statusCode: res.statusCode,
          loadTime: Math.round(loadTime),
          contentLength: data.length,
          headers: res.headers
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      reject(new Error('Request timeout'));
    });
  });
}

// Main testing function
async function runPerformanceTests() {
  console.log('📊 Testing page load times...\n');
  
  const results = [];
  
  for (const page of TEST_PAGES) {
    const url = `${BASE_URL}${page}`;
    
    try {
      console.log(`🔍 Testing: ${url}`);
      const result = await measurePageLoad(url);
      results.push(result);
      
      console.log(`   ✅ ${result.statusCode} - ${result.loadTime}ms (${(result.contentLength / 1024).toFixed(2)}KB)`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        url,
        error: error.message,
        loadTime: null
      });
    }
  }
  
  console.log('\n📈 Performance Summary:');
  console.log('========================');
  
  const successfulTests = results.filter(r => !r.error && r.loadTime);
  if (successfulTests.length > 0) {
    const avgLoadTime = successfulTests.reduce((sum, r) => sum + r.loadTime, 0) / successfulTests.length;
    const fastestPage = successfulTests.reduce((min, r) => r.loadTime < min.loadTime ? r : min);
    const slowestPage = successfulTests.reduce((max, r) => r.loadTime > max.loadTime ? r : max);
    
    console.log(`📊 Average load time: ${Math.round(avgLoadTime)}ms`);
    console.log(`🏆 Fastest page: ${fastestPage.url} (${fastestPage.loadTime}ms)`);
    console.log(`🐌 Slowest page: ${slowestPage.url} (${slowestPage.loadTime}ms)`);
    
    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    if (avgLoadTime > 1000) {
      console.log('   - Consider further optimizing images and assets');
      console.log('   - Implement more aggressive code splitting');
      console.log('   - Add service worker for caching');
    }
    if (avgLoadTime > 2000) {
      console.log('   - Review and optimize database queries');
      console.log('   - Consider CDN for static assets');
      console.log('   - Implement server-side caching');
    }
    if (avgLoadTime < 500) {
      console.log('   🎉 Excellent performance! Consider A/B testing further optimizations.');
    }
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('   - Run Lighthouse audit for detailed metrics');
  console.log('   - Test on different devices and network conditions');
  console.log('   - Monitor Core Web Vitals in production');
}

// Run the tests
runPerformanceTests().catch(console.error); 