const webPush = require('web-push');

const publicVapidKey = 'BI77cEBaJDS7BT_bpo8zt7jjIdZhXVmMr2881f2TNVIUo6irIsgqp9KZYXeAVggEvXN9nyIQBUupl1RLUPgs9EM';
const privateVapidKey = 'DYlddr8D0siYgiaqDW1kNVaip1VMj0gQ3qQp6K6f-yQ';

webPush.setVapidDetails(
  'mailto:merrouchmokhtar@gmail.com',
  publicVapidKey,
  privateVapidKey
);

module.exports = webPush;
