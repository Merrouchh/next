// utils/api.js
export const validateUserCredentials = async (username, password) => {
    try {
      // POST to your API handler
      const response = await fetch('/api/validateUserCredentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
  
      const data = await response.json();
  
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
      return { isValid: false }; // Handle errors
    }
  };
    
// utils/api.js
export const fetchActiveUserSessions = async () => {
    try {
        const response = await fetch('/api/fetchActiveUserSessions');
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
        const response = await fetch(`/api/fetchUserBalance/${userId}`);
        if (!response.ok) throw new Error('Error fetching user balance');
        const data = await response.json();
        return data.balance || 'Error fetching time';
    } catch (error) {
        console.error('Error fetching user balance:', error);
        return 'Error fetching time';
    }
};


// utils/api.js
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

export const fetchTopUsers = async (topUsersNumber) => {
  try {
    const url = `/api/fetchtopuser?topUsersNumber=${topUsersNumber}`;

    const response = await fetch(url);

    if (response.status === 404) {
      return []; // Return an empty array or handle as needed
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error fetching top users: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data; // Return the fetched data
  } catch (error) {
    return [];
  }
};

