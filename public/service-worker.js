// Service Worker Version - INCREMENT THIS WHEN CHANGES ARE MADE
const SW_VERSION = '3.0.0';
const CACHE_NAME = 'merrouch-gaming-v3';
const PUSH_SUBSCRIPTION_VERSION = '2.0'; // New version for push subscriptions

const urlsToCache = [
  '/',
  '/avcomputers',
  '/favicon.ico',
  '/logo.png',
  '/manifest.json'
];

// Install event - cache resources and handle push subscription migration
self.addEventListener('install', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Installing...`);
  event.waitUntil(
    Promise.all([
      // Cache resources
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('Service Worker: Caching files');
          return Promise.allSettled(
            urlsToCache.map(url => 
              cache.add(url).catch(error => {
                console.log(`Failed to cache ${url}:`, error);
                return null;
              })
            )
          );
        })
        .catch((error) => {
          console.log('Service Worker: Cache failed', error);
        }),
      
      // Check and handle push subscription migration
      migratePushSubscription()
    ])
  );
  
  // Force the service worker to activate immediately
  self.skipWaiting();
});

// Function to handle push subscription migration
async function migratePushSubscription() {
  try {
    console.log('🔄 Checking push subscription migration...');
    
    // Get current subscription
    const currentSubscription = await self.registration.pushManager.getSubscription();
    
    if (currentSubscription) {
      // Check if subscription uses old VAPID key or needs migration
      const storedVersion = await getStoredSubscriptionVersion();
      
      if (storedVersion !== PUSH_SUBSCRIPTION_VERSION) {
        console.log('🔄 Migration needed - unsubscribing from old push service...');
        
        // Unsubscribe from old push service
        await currentSubscription.unsubscribe();
        console.log('✅ Old push subscription removed');
        
        // Store migration flag for main thread to handle re-subscription
        await setMigrationFlag(true);
        
        // Notify all clients about the migration
        notifyClientsAboutMigration();
      } else {
        console.log('✅ Push subscription is up to date');
      }
    } else {
      console.log('ℹ️ No existing push subscription found');
    }
  } catch (error) {
    console.error('❌ Push subscription migration failed:', error);
  }
}

// Helper function to get stored subscription version
async function getStoredSubscriptionVersion() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/sw-push-version');
    if (response) {
      const data = await response.json();
      return data.version;
    }
  } catch (error) {
    console.log('No stored push subscription version found');
  }
  return null;
}

// Helper function to store subscription version
async function storeSubscriptionVersion(version) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify({ version }), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/sw-push-version', response);
  } catch (error) {
    console.error('Failed to store subscription version:', error);
  }
}

// Helper function to set migration flag
async function setMigrationFlag(needsMigration) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify({ needsMigration, timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/sw-migration-flag', response);
  } catch (error) {
    console.error('Failed to set migration flag:', error);
  }
}

// Helper function to get migration flag
async function getMigrationFlag() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/sw-migration-flag');
    if (response) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('No migration flag found');
  }
  return { needsMigration: false };
}

// Notify all clients about migration
function notifyClientsAboutMigration() {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_SUBSCRIPTION_MIGRATION_NEEDED',
        version: PUSH_SUBSCRIPTION_VERSION
      });
    });
  });
}

// Activate event - clean up old caches and handle migration
self.addEventListener('activate', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Activating...`);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim().then(() => {
        // Notify clients about service worker update
        return notifyClientsAboutUpdate();
      })
    ])
  );
  console.log(`Service Worker v${SW_VERSION}: Activated and claimed all clients`);
});

// Notify clients about service worker update
async function notifyClientsAboutUpdate() {
  const migrationFlag = await getMigrationFlag();
  
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SERVICE_WORKER_UPDATED',
        version: SW_VERSION,
        needsPushMigration: migrationFlag.needsMigration
      });
    });
  });
}

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip caching for API requests, WebSocket connections, and Next.js internals
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/_next/') ||
    event.request.url.includes('/socket.io/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Return cached version
          return response;
        }
        
        // Fetch from network and cache for next time
        return fetch(event.request).then((fetchResponse) => {
          // Check if we received a valid response
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response as it can only be consumed once
          const responseToCache = fetchResponse.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return fetchResponse;
        });
      })
      .catch(() => {
        // If both fail, show offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received', event);
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (error) {
      notificationData = {
        title: 'Merrouch Gaming',
        body: event.data.text() || 'You have a new notification',
        icon: '/logo.png',
        badge: '/favicon.ico'
      };
    }
  }
  
  const options = {
    body: notificationData.body || 'You have a new notification',
    icon: notificationData.icon || '/logo.png',
    badge: notificationData.badge || '/favicon.ico',
    tag: notificationData.tag || 'general',
    data: notificationData.data || {},
    actions: notificationData.actions || [],
    requireInteraction: notificationData.requireInteraction || false,
    vibrate: notificationData.vibrate || [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'Merrouch Gaming',
      options
    )
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  // Handle notification actions
  if (event.action) {
    switch (event.action) {
      case 'view':
        event.waitUntil(
          clients.openWindow(event.notification.data.url || '/')
        );
        break;
      case 'dismiss':
        break;
    }
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
    );
  }
});

// Background sync for offline queue actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'queue-update') {
    event.waitUntil(
      // Handle background queue updates when online
      fetch('/api/computer-queue?sync=true')
        .then(response => response.json())
        .then(data => {
          if (data.notifications) {
            // Send any pending notifications
            data.notifications.forEach(notification => {
              self.registration.showNotification(notification.title, notification.options);
            });
          }
        })
        .catch(error => {
          console.log('Background sync failed:', error);
        })
    );
  }
});

// Message event - communication with main thread
self.addEventListener('message', async (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
  
  if (event.data && event.data.type === 'PUSH_SUBSCRIPTION_SUCCESS') {
    // Store the new subscription version when migration is successful
    await storeSubscriptionVersion(PUSH_SUBSCRIPTION_VERSION);
    await setMigrationFlag(false);
    console.log('✅ Push subscription migration completed');
  }
  
  if (event.data && event.data.type === 'GET_MIGRATION_STATUS') {
    const migrationFlag = await getMigrationFlag();
    event.ports[0].postMessage({
      needsMigration: migrationFlag.needsMigration,
      version: PUSH_SUBSCRIPTION_VERSION
    });
  }
}); 