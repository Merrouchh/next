require('dotenv').config();
const { sendTopUsersScreenshot } = require('./sendTopUsersScreenshot');

async function testSendTopUsersScreenshot() {
  try {
    console.log('Running testSendTopUsersScreenshot...');
    await sendTopUsersScreenshot();
    console.log('Test completed successfully.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSendTopUsersScreenshot();

