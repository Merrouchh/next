require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID; // Your Telegram chat ID
const bot = new TelegramBot(token, { polling: false });

async function sendTelegramMessage(photoPath) {
  try {
    await bot.sendPhoto(chatId, photoPath, {
      caption: 'Here is the screenshot of the top users for this month.',
    });
    console.log('Message sent successfully');
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

module.exports = sendTelegramMessage;
