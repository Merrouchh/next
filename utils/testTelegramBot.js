require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID; // Your Telegram chat ID
const bot = new TelegramBot(token, { polling: false });

async function sendTestMessage() {
  try {
    await bot.sendMessage(chatId, 'Hi');
    console.log('Test message sent successfully.');
  } catch (error) {
    console.error('Error sending test message:', error);
  }
}

sendTestMessage();
