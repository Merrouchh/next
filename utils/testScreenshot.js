const takeScreenshot = require('./screenshot');
const path = require('path');

const url = 'https://merrouchgaming.com:3000/topusers'; // Replace with your actual URL
const screenshotPath = path.join(__dirname, 'topusers.png');

async function testTakeScreenshot() {
  try {
    await takeScreenshot(url, screenshotPath);
    console.log('Screenshot taken successfully.');
  } catch (error) {
    console.error('Error taking screenshot:', error);
  }
}

testTakeScreenshot();
