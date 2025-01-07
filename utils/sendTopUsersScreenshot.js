require('dotenv').config();
const takeScreenshot = require('./screenshot');
const sendTelegramMessage = require('./sendTelegram');
const path = require('path');
const fs = require('fs');

const url = 'https://merrouchgaming.com/topusers'; // Replace with your actual URL
const screenshotPath = path.join(__dirname, 'topusers.png');

async function sendTopUsersScreenshot() {
  try {
    console.log('Starting screenshot process...');
    await takeScreenshot(url, screenshotPath);
    console.log('Screenshot taken, sending via Telegram...');
    await sendTelegramMessage(screenshotPath);
    fs.unlinkSync(screenshotPath); // Clean up the local file
    console.log('Screenshot sent successfully.');
  } catch (error) {
    console.error('Error sending screenshot:', error);
  }
}

module.exports = { sendTopUsersScreenshot };
