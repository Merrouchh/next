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
    
// utils/api.js
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

export const fetchUserBalance = async (userId) => {
  try {
    const response = await fetch(`/api/fetchUserBalance/${userId}`);
    if (!response.ok) throw new Error('Error fetching user balance');
    const data = await response.json();
    console.log('API response (user balance):', data); // Add this line
    return data.balance || 'Error fetching time';
  } catch (error) {
    console.error('Error fetching user balance:', error);
    return 'Error fetching time';
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

// Remove the duplicate getUserIdByUsername and getGizmoIdByUsername functions
// and replace with a single function to get Gizmo ID:

export const fetchGizmoId = async (username) => {
  try {
    const response = await fetch(`/api/returngizmoid?username=${username}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch Gizmo ID:', errorData);
      throw new Error(errorData.error || 'Failed to fetch Gizmo ID');
    }

    const data = await response.json();
    return {
      gizmoId: data.gizmo_id,
      message: data.message
    };
  } catch (error) {
    console.error('Error fetching Gizmo ID:', error);
    throw error;
  }
};

export const fetchUserPoints = async (gizmoId) => {
  try {
    if (!gizmoId) {
      throw new Error('Gizmo ID is required');
    }

    const response = await fetch(`/api/points/${gizmoId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch user points:', errorData);
      throw new Error(errorData.error || 'Failed to fetch user points');
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

