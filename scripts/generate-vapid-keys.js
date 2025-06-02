const webpush = require('web-push');

console.log('🔑 Generating VAPID keys for web push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔑 VAPID Keys Generated:');
console.log('========================');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
console.log('\n📋 Add these to your .env.local:');
console.log('==================================');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:admin@merrouchgaming.com`);
console.log('\n⚠️  Keep the private key secret! Do not commit it to version control.');
console.log('\n🚀 After adding to .env.local, restart your development server!'); 