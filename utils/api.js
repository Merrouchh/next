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
    
export const fetchActiveUserSessions = async () => {
  try {
    const response = await fetch('/api/fetchActiveUserSessions');
    if (!response.ok) throw new Error('Error fetching active sessions');
    const data = await response.json();
    console.log('API response (active sessions):', data); // Add this line
    return data.result || [];
  } catch (error) {
    console.error('Error fetching active user sessions:', error);
    return [];
  }
};

export const fetchUserBalance = async (gizmoId) => {
  try {
    const response = await fetch(`/api/users/${gizmoId}/balance`);
    if (!response.ok) {
      console.error('Error response from balance API:', response.status);
      throw new Error('Failed to fetch balance info');
    }

    const data = await response.json();
    console.log('Balance info:', data);

    return {
      balance: data.balance || 0,
      hasDebt: data.balance < 0,
      debtAmount: data.balance < 0 ? Math.abs(data.balance) : 0
    };
  } catch (error) {
    console.error('Error fetching user balance:', error);
    return {
      balance: 0,
      hasDebt: false,
      debtAmount: 0
    };
  }
};

export const fetchUserById = async (userId) => {
    try {
        const response = await fetch(`/api/fetchUserById/${userId}`);
        if (!response.ok) throw new Error('Error fetching user by ID');
        const data = await response.json();
        return data.user || null;
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return null;
    }
};

export const fetchTopUsers = async (numberOfUsers = 10) => {
  console.log('fetchTopUsers called');
  try {
    console.log('Making request to /api/fetchtopusers');
    const response = await fetch(`/api/fetchtopusers?numberOfUsers=${numberOfUsers}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Top users fetch failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch top users: ${response.status}`);
    }

    const data = await response.json();
    console.log('Top users fetch succeeded:', data);
    return data;
  } catch (error) {
    console.error('Error in fetchTopUsers:', error);
    throw error;
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

export const fetchUserTimeInfo = async (gizmoId) => {
  try {
    const response = await fetch(`/api/users/${gizmoId}/producttimeextended`);
    if (!response.ok) {
      console.error('Error response from time info API:', response.status);
      throw new Error('Failed to fetch time info');
    }

    const data = await response.json();
    console.log('Time info API response:', data);

    // Check if data has the expected structure
    if (!data || !Array.isArray(data.result)) {
      console.error('Invalid data structure received:', data);
      return {
        vip: { hours: 0, minutes: 0 },
        normal: { hours: 0, minutes: 0 },
        bonus: { hours: 0, minutes: 0 }
      };
    }

    const validEntries = data.result.filter(entry => 
      entry && !entry.isDepleted && !entry.isVoided
    );

    // Calculate totals for each category
    const totals = validEntries.reduce((acc, entry) => {
      if (!entry || !entry.productName) return acc;

      const category = entry.productName.toLowerCase().includes('vip') ? 'vip' :
                      entry.productName.toLowerCase().includes('normal') ? 'normal' : 'bonus';
      
      acc[category] += (entry.secondsLeft || 0);
      return acc;
    }, { vip: 0, normal: 0, bonus: 0 });

    // Convert seconds to hours and minutes
    const formatTime = (seconds) => ({
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor((seconds % 3600) / 60)
    });

    return {
      vip: formatTime(totals.vip),
      normal: formatTime(totals.normal),
      bonus: formatTime(totals.bonus)
    };
  } catch (error) {
    console.error('Error fetching user time info:', error);
    // Return default values on error
    return {
      vip: { hours: 0, minutes: 0 },
      normal: { hours: 0, minutes: 0 },
      bonus: { hours: 0, minutes: 0 }
    };
  }
};

