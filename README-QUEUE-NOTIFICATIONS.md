# Queue Monitor with WhatsApp Notifications

## 🚀 Quick Start

Your queue monitoring with WhatsApp notifications is now **automatically included** with `npm start`!

```bash
npm start
```

This will start:
- ✅ **Next.js Server** (blue output)  
- ✅ **Queue Monitor with WhatsApp** (green output)

## 📱 WhatsApp Setup

### 1. Add API Key
Add to your `.env.local`:
```env
INFOBIP_API_KEY=your_infobip_api_key_here
```

### 2. Required Templates
Make sure these templates are approved in your Infobip dashboard:

**Template: `client_queue`**
```
👋 Hi {{1}}, here's your current queue status: 📍 Position: [#{{2}} in queue]
```
- Button: Static URL to https://merrouchgaming.com/avcomputers

**Template: `your_turn_has_come`**
```
🎮 {{1}}, your turn has come! ✅ We are logging you in now...
```
- Button: Static phone button with +212656053641

## 🎯 What It Does

✅ **Auto-removal** - Removes users who log into computers (every 30s)  
✅ **Real-time WhatsApp** - Instant position updates via Supabase subscriptions  
✅ **Your Turn notifications** - Special message when reaching position 1  
✅ **Queue management** - Auto-starts/stops queue system when needed  

## ⚙️ Manual Control

If you want to run just the queue monitor separately:

```bash
# Real-time mode (recommended)
npm run queue-monitor:realtime

# Periodic mode (every 60s)
npm run queue-monitor

# Single execution
npm run queue-monitor:once
```

## 🔧 Server Only

To start just the Next.js server without queue monitoring:

```bash
npm run start:server-only
```

## 📋 Features

- **Clean Architecture** - Queue APIs have no notification logic
- **Real-time Updates** - Instant WhatsApp notifications when queue changes
- **Auto-removal** - Smart detection of logged-in users
- **Graceful Fallback** - Works without WhatsApp API (just logs warnings)
- **Production Ready** - Proper error handling and process management

## 🎊 Benefits

✅ One command starts everything (`npm start`)  
✅ Real-time WhatsApp notifications  
✅ Clean separation of concerns  
✅ Easy to monitor with colored output  
✅ Automatic queue management  

Your queue system is now **fully automated** with smart WhatsApp notifications! 🎉 