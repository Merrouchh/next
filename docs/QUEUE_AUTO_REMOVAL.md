# Automatic Queue Removal System

This document explains how the automatic queue removal system works to prevent users from staying in the queue after they've already logged into a computer.

## The Problem

Previously, users could end up in these situations:
1. Join the queue online, then physically go to the gaming center and log in directly
2. Be manually logged in by an admin but remain in the queue
3. Get logged in through other means but the queue system doesn't know about it

This leads to:
- Inaccurate queue positions for other users
- Users getting double notifications
- Queue never naturally emptying
- Confusion for both users and staff

## The Solution

We've implemented **two complementary approaches** to automatically remove users from the queue when they log into computers:

### 1. Real-time Integration (Immediate)
- Integrated into the login flow in `avcomputers.js`
- Automatically removes users immediately when they successfully log in through the website
- Uses the `queueUtils.js` utility functions

### 2. Background Monitoring Script (Comprehensive)
- Independent monitoring script that runs continuously
- Catches all login scenarios (physical, admin, API, etc.)
- Provides comprehensive coverage and acts as a safety net

## Implementation Details

### Real-time Integration

The `handleLoginSuccess` function in `avcomputers.js` now includes:

```javascript
// Automatically remove user from queue if they were in it
try {
  const { removeUserFromQueueByGizmoId } = await import('../utils/queueUtils');
  await removeUserFromQueueByGizmoId(
    user.gizmoId, 
    `logged into ${computer.type} floor computer ${computer.number}`
  );
} catch (error) {
  console.error('Error removing user from queue after login:', error);
}
```

### Background Monitoring Script

The monitoring script (`scripts/queue-monitor.js`) works as follows:

1. **Fetches Data**: Gets all active user sessions from the Gizmo API
2. **Cross-References**: Checks which users are both logged in AND in the queue
3. **Removes Users**: Automatically removes logged-in users from the queue
4. **Logs Activity**: Provides detailed logging for monitoring and debugging

## How to Use

### Running the Monitoring Script

#### Option 1: Continuous Monitoring (Recommended for Production)
```bash
# Run continuously (checks every 60 seconds)
npm run queue-monitor

# Or directly with node
node scripts/queue-monitor.js
```

#### Option 2: Single Execution (Good for Testing)
```bash
# Run once and exit
npm run queue-monitor-once

# Or directly with node
node scripts/queue-monitor.js --once
```

### Environment Variables Required

Make sure these environment variables are set:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
API_BASE_URL=your_gizmo_api_url
API_AUTH=your_gizmo_api_credentials
```

### Production Deployment Options

#### Option 1: Run as a Background Service
```bash
# Using PM2 (recommended)
pm2 start scripts/queue-monitor.js --name "queue-monitor"
pm2 save
pm2 startup
```

#### Option 2: Run as a Cron Job
```bash
# Edit crontab
crontab -e

# Add this line to run every minute
* * * * * cd /path/to/your/project && npm run queue-monitor-once >> /var/log/queue-monitor.log 2>&1
```

#### Option 3: Run as a Docker Container
```dockerfile
# Add to your existing Dockerfile or create a separate one
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY scripts/ ./scripts/
COPY utils/ ./utils/
CMD ["npm", "run", "queue-monitor"]
```

## Monitoring and Logs

### Log Output Examples

**Successful Removal:**
```
🔍 [3:45:12 PM] Starting queue monitoring...
📊 Found 3 active sessions and 5 people in queue
🔗 Found 4 queue users with linked gizmo accounts
🎯 Found 1 users to remove from queue

🚮 Removing users from queue:
✅ Removed john_doe from queue (logged into computer (Host ID: 26))

✨ Queue monitoring complete - removed 1 users
```

**No Action Needed:**
```
🔍 [3:46:12 PM] Starting queue monitoring...
📊 Found 3 active sessions and 4 people in queue
🔗 Found 3 queue users with linked gizmo accounts
🎯 Found 0 users to remove from queue
✅ No users need to be removed from queue
```

### Monitoring the System

1. **Check Script Status**:
   ```bash
   # If using PM2
   pm2 status queue-monitor
   pm2 logs queue-monitor
   
   # If using manual execution
   tail -f /var/log/queue-monitor.log
   ```

2. **Database Monitoring**:
   - Monitor the `computer_queue` table for automatic removals
   - Check queue positions are being properly maintained
   - Verify that logged-in users are not staying in the queue

## Utility Functions

The `utils/queueUtils.js` file provides these functions:

- `removeUserFromQueueByGizmoId(gizmoId, reason)` - Remove user by their Gizmo ID
- `removeUserFromQueueByUserId(userId, reason)` - Remove user by database user ID  
- `getUserQueueEntry(userId)` - Check if a user is in the queue
- `getQueueStats()` - Get detailed queue statistics

## Testing

### Test the Monitoring Script
```bash
# Test with a single execution
npm run queue-monitor-once

# Check the output for any errors
# Should show current queue status and any actions taken
```

### Test the Real-time Integration
1. Have a user join the queue through the website
2. Log that user into a computer through the website
3. Verify the user is automatically removed from the queue
4. Check the browser console for success messages

## Troubleshooting

### Common Issues

1. **Script Can't Connect to Database**
   - Check Supabase credentials
   - Verify network connectivity
   - Ensure service role key has proper permissions

2. **Script Can't Fetch Active Sessions**
   - Check Gizmo API credentials
   - Verify API_BASE_URL is correct
   - Test API connectivity manually

3. **Users Not Being Removed**
   - Check if users have linked gizmo_id in the database
   - Verify queue entries have proper user_id associations
   - Check database permissions for the service role

### Debug Mode

Add debug logging by modifying the script or running with additional logging:

```javascript
// Add this to see more detailed information
console.log('Active sessions:', activeSessions);
console.log('Queue entries:', queueEntries);
console.log('User gizmo ID mapping:', userGizmoIds);
```

## Benefits

✅ **Automatic Cleanup**: Users are removed from queue when they log in  
✅ **Accurate Queue Positions**: Other users see correct wait times  
✅ **Reduced Confusion**: No double notifications or phantom queue entries  
✅ **Better User Experience**: Queue system stays clean and functional  
✅ **Staff Efficiency**: Less manual queue management needed  
✅ **Comprehensive Coverage**: Catches all login scenarios, not just web logins  

## Future Improvements

Potential enhancements to consider:

1. **Web Push Notifications**: Notify removed users that they've been logged in
2. **Queue Analytics**: Track removal patterns and optimize queue management
3. **Smart Notifications**: Send different messages based on removal reason
4. **Integration with Gizmo Events**: Listen to Gizmo API events for real-time updates
5. **Dashboard Integration**: Show queue removal activity in admin dashboard 