import { createBrowserClient } from '@supabase/ssr'

// Cache for the configuration
let configCache: { url: string; anonKey: string } | null = null;

export function createClient() {
  // For server-side rendering, use server environment variables
  if (typeof window === 'undefined') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing server-side Supabase configuration');
    }
    
    return createBrowserClient(supabaseUrl, supabaseKey);
  }

  // For client-side, we need to fetch config from secure endpoint
  // This is a synchronous function, so we'll use a cached approach
  if (!configCache) {
    // Fallback: try to get from window if available (for backward compatibility during transition)
    const fallbackUrl = (window as any).__SUPABASE_URL__;
    const fallbackKey = (window as any).__SUPABASE_ANON_KEY__;
    
    if (fallbackUrl && fallbackKey) {
      configCache = { url: fallbackUrl, anonKey: fallbackKey };
    } else {
      // Return null instead of throwing error to allow lazy initialization
      return null;
    }
  }

  return createBrowserClient(configCache.url, configCache.anonKey);
}

// Function to initialize client-side configuration
export async function initializeSupabaseConfig() {
  if (typeof window === 'undefined') return;
  
  try {
    const response = await fetch('/api/config/supabase', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const config = await response.json();
      configCache = { url: config.url, anonKey: config.anonKey };
      
      // Store in window for immediate access
      (window as any).__SUPABASE_URL__ = config.url;
      (window as any).__SUPABASE_ANON_KEY__ = config.anonKey;
    }
  } catch (error) {
    console.warn('Failed to load Supabase configuration:', error);
  }
}