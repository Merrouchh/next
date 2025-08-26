/**
 * Secure client-side Supabase utilities
 * This approach avoids exposing sensitive keys to the client bundle
 */

/**
 * Make authenticated requests to our own API endpoints
 * instead of directly to Supabase from the client
 */
export async function makeAuthenticatedRequest(endpoint, options = {}) {
  try {
    // Get session token from localStorage (set by Supabase auth)
    const session = JSON.parse(localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF + '-auth-token') || '{}');
    const accessToken = session?.access_token;
    
    if (!accessToken) {
      throw new Error('No authentication token found');
    }
    
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Authenticated request failed:', error);
    throw error;
  }
}

/**
 * Client-side auth utilities that work through API endpoints
 * instead of direct Supabase client access
 */
export const secureAuth = {
  async getCurrentUser() {
    return makeAuthenticatedRequest('/api/auth/user');
  },
  
  async signOut() {
    return makeAuthenticatedRequest('/api/auth/signout', { method: 'POST' });
  },
  
  async refreshSession() {
    return makeAuthenticatedRequest('/api/auth/refresh', { method: 'POST' });
  }
};

/**
 * Secure database operations through API endpoints
 */
export const secureDb = {
  async query(table, options = {}) {
    return makeAuthenticatedRequest('/api/db/query', {
      method: 'POST',
      body: JSON.stringify({ table, ...options }),
    });
  },
  
  async insert(table, data) {
    return makeAuthenticatedRequest('/api/db/insert', {
      method: 'POST',
      body: JSON.stringify({ table, data }),
    });
  },
  
  async update(table, data, filters) {
    return makeAuthenticatedRequest('/api/db/update', {
      method: 'POST',
      body: JSON.stringify({ table, data, filters }),
    });
  },
  
  async delete(table, filters) {
    return makeAuthenticatedRequest('/api/db/delete', {
      method: 'POST',
      body: JSON.stringify({ table, filters }),
    });
  }
};
