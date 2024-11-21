// Helper function to build API URLs
export function buildApiUrl(endpoint) {
    return `https://merrouchgaming.live/api${endpoint}`; // Ensure you're using HTTPS
}

// Get common headers for API requests
export function getAuthHeaders() {
    return new Headers({
        'Authorization': 'Basic ' + btoa('admin:Mg200723@l') // Your API credentials
    });
}

export const validateUserCredentials = async (username, password) => {
    const apiUrl = buildApiUrl(`/users/${encodeURIComponent(username)}/${encodeURIComponent(password)}/valid`);

    console.log('Fetching API URL:', apiUrl);

    try {
        const response = await fetch(apiUrl, { headers: getAuthHeaders() });

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status}`); // Log HTTP error
            throw new Error(`HTTP status ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response Body:', data); // Log the full API response

        // Check if result === 0 means success (valid user)
        if (data && data.result && data.result.result === 0) {
            return {
                isValid: true,
                userId: data.result.identity.userId,
                username: data.result.identity.name
            };
        } else {
            return { isValid: false }; // Invalid credentials or other error
        }
    } catch (error) {
        console.error('Error in API call:', error);
        return { isValid: false }; // Handle errors
    }
};

export async function fetchActiveUserSessions() {
    const apiUrl = buildApiUrl('/usersessions/active');
    try {
        const response = await fetch(apiUrl, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Error fetching active sessions');
        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error('Error fetching active user sessions:', error);
        return [];
    }
}


export const fetchUserId = async (username) => {
    try {
        console.log('API Call - fetching user ID for:', username);
        const response = await fetch(buildApiUrl(`/users/${username}`), { headers: getAuthHeaders() });
        const data = await response.json();
        console.log('Fetched user ID:', data.userId);
        return data.userId;
    } catch (error) {
        console.error('Error in fetchUserId:', error);
        return null; // Return null if something goes wrong
    }
};


export async function fetchUserBalance(userId) {
    const apiUrl = buildApiUrl(`/users/${userId}/balance`);
    try {
        const response = await fetch(apiUrl, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const totalHours = data.result.availableTime / 3600;
        const hours = Math.floor(totalHours);
        const minutes = Math.floor((totalHours - hours) * 60);
        
        return data.result.availableTime <= 0 ? 'No Time Left' : `${hours}h : ${minutes} min`;
    } catch (error) {
        console.error('Error fetching user balance:', error);
        return 'Error fetching time'; // Handle errors appropriately
    }
}

// Fetch user by ID
export async function fetchUserById(userId) {
    const apiUrl = buildApiUrl(`/users/${userId}`);
    try {
        const response = await fetch(apiUrl, { headers: getAuthHeaders() });
        console.log(`Fetching user from ${apiUrl}`);
        if (!response.ok) throw new Error('Error fetching user by ID');
        const data = await response.json();
        console.log('User data:', data);
        return data.result || null; // Assuming 'result' contains the user data
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return null; // Handle errors appropriately
    }
}