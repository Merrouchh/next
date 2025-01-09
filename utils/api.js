import { createClient } from './supabase/client';

// utils/api.js
export const validateUserCredentials = async (username, password) => {
  try {
    console.log('Validating user credentials for username:', username);
    // POST to your API handler
    const response = await fetch('/api/validateUserCredentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      console.error('HTTP status:', response.status);
      throw new Error(`HTTP status ${response.status}`);
    }

    const data = await response.json();
    console.log('Validation response data:', data);

    // Assuming the API returns data.result.result === 0 for valid credentials
    if (data && data.result && data.result.result === 0) {
      return {
        isValid: true,
        userId: data.result.identity.userId,
        username: data.result.identity.name,
      };
    } else {
      return { isValid: false }; // Invalid credentials
    }
  } catch (error) {
    console.error('Validation error:', error);
    return { isValid: false }; // Handle errors
  }
};
    
// Add a reusable fetch function with cache control
const fetchWithNoCache = async (url, options = {}) => {
  const defaultOptions = {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...options.headers
    }
  };

  return fetch(url, { ...options, ...defaultOptions });
};

export const fetchActiveUserSessions = async () => {
  try {
    const response = await fetchWithNoCache('/api/fetchActiveUserSessions');
    if (!response.ok) throw new Error('Error fetching active sessions');
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching active user sessions:', error);
    return [];
  }
};

export const fetchUserBalance = async (userId) => {
  try {
    const response = await fetchWithNoCache(`/api/fetchUserBalance/${userId}`);
    if (!response.ok) throw new Error('Error fetching user balance');
    const data = await response.json();
    return data.balance;
  } catch (error) {
    console.error('Error fetching user balance:', error);
    return 'Error';
  }
};

export const fetchUserById = async (userId) => {
  try {
    const response = await fetchWithNoCache(`/api/fetchUserById/${userId}`);
    if (!response.ok) {
      console.warn(`Failed to fetch user ${userId}, status: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

export const fetchTopUsers = async (numberOfUsers = 10) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetchWithNoCache(`/api/fetchtopusers?numberOfUsers=${numberOfUsers}&t=${Date.now()}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Top users fetch failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timeout fetching top users');
    } else {
      console.error('Error in fetchTopUsers:', error);
    }
    return [];
  }
};


export const fetchGizmoId = async (username) => {
  try {
    const response = await fetch(`/api/returngizmoid?username=${username}`);
    if (!response.ok) throw new Error('Error fetching Gizmo ID');
    const data = await response.json();
    return {
      gizmoId: data.gizmo_id,
      message: 'Gizmo ID fetched successfully'
    };
  } catch (error) {
    console.error('Error fetching Gizmo ID:', error);
    throw error;
  }
};

export const fetchUserPoints = async (gizmoId) => {
  const url = `/api/points/${gizmoId}`;
  try {
    console.log(`Fetching user points from URL: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch user points from ${url}:`, errorText);
      throw new Error(errorText || 'Failed to fetch user points');
    }

    const data = await response.json();
    return {
      points: data.result,
      success: !data.isError
    };
  } catch (error) {
    console.error('Error fetching user points:', error);
    throw error;
  }
};

