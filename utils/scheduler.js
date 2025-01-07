const cron = require('node-cron');
const { sendTopUsersScreenshot } = require('./sendTopUsersScreenshot');

// Schedule the script to run at 11:55 PM on the last day of each month
cron.schedule('55 23 28-31 * *', async () => {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() === lastDayOfMonth) {
    console.log('Running scheduled task: sendTopUsersScreenshot');
    await sendTopUsersScreenshot();
  }
});