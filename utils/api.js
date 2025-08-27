import { createClient } from '../utils/supabase/component';

// Lazy initialization of Supabase client
let supabase = null;
const getSupabase = () => {
  if (!supabase) {
    try {
      supabase = createClient();
    } catch (error) {
      console.warn('Supabase client not ready:', error.message);
      return null;
    }
  }
  return supabase;
};

// utils/api.js
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;

const fetchConfig = {
  headers: {
    'Content-Type': 'application/json'
  }
};

// Helper function to get authenticated headers
const getAuthHeaders = async () => {
  try {
    const supabaseClient = getSupabase();
    if (!supabaseClient) return {};
    const { data } = await supabaseClient.auth.getSession();
    const accessToken = data?.session?.access_token;
    
    if (accessToken) {
      return {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }
  
  return {
    'Content-Type': 'application/json'
  };
};

// Helper function to check if user is authenticated
const isUserAuthenticated = async () => {
  try {
    const supabaseClient = getSupabase();
    if (!supabaseClient) return false;
    const { data } = await supabaseClient.auth.getSession();
    return !!data?.session?.access_token;
  } catch (error) {
    return false;
  }
};

const enhancedFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  const finalOptions = {
    ...fetchConfig,
    ...options,
    headers: {
      ...fetchConfig.headers,
      ...options.headers
    },
    signal: controller.signal
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, finalOptions);
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      
      if (attempt === MAX_RETRIES - 1) {
        throw error;
      }

      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};

export const validateUserCredentials = async (username, password) => {
  try {
    console.log('Validating user credentials for username:', username);
    
    // Add error handling for empty parameters
    if (!username || !password) {
      console.error('Missing required parameters for validation');
      return { isValid: false, error: 'Username and password are required' };
    }

    // Check if user is authenticated first (admin/staff only endpoint)
    const isAuth = await isUserAuthenticated();
    if (!isAuth) {
      console.warn('User not authenticated, cannot validate credentials');
      return { isValid: false, error: 'Admin authentication required' };
    }
    
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/validateUserCredentials', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      credentials: 'same-origin', // Include cookies for session handling
      headers: {
        ...authHeaders,
        'X-Requested-With': 'XMLHttpRequest' // Helps with some ad blockers
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('Authentication/authorization required for credential validation');
        return { 
          isValid: false, 
          error: 'Admin access required',
          status: response.status
        };
      }
      console.error('HTTP status:', response.status);
      // Add more detailed error information
      return { 
        isValid: false, 
        error: `Server error: ${response.status}`,
        status: response.status
      };
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
      // Return more detailed error information
      return { 
        isValid: false,
        error: data.message || 'Invalid credentials',
        details: data.result || {}
      };
    }
  } catch (error) {
    console.error('Validation error:', error);
    // Detect common privacy browser errors
    const isPrivacyBlock = error.message?.includes('Failed to fetch') || 
                           error.message?.includes('NetworkError') ||
                           error.message?.includes('AbortError') ||
                           error.message?.includes('timeout') ||
                           error.name === 'AbortError';
    
    return { 
      isValid: false,
      error: isPrivacyBlock 
        ? 'Browser privacy settings may be blocking this request' 
        : error.message || 'Connection error',
      isConnectionError: true,
      isPrivacyBlock: isPrivacyBlock
    };
  }
};
    
export const fetchActiveUserSessions = async () => {
  try {
    // Check if user is authenticated first
    const isAuth = await isUserAuthenticated();
    if (!isAuth) {
      console.warn('User not authenticated, skipping sessions fetch');
      return [];
    }

    // Add cache-busting timestamp
    const timestamp = Date.now();
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`/api/fetchactivesessions?t=${timestamp}`, {
      ...fetchConfig,
      headers: {
        ...authHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('Authentication/authorization required for sessions fetch');
        return [];
      }
      throw new Error('Failed to fetch sessions');
    }
    
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.warn('Error fetching active sessions:', error);
    return [];
  }
};


export const fetchUserBalance = async (gizmoId) => {
  try {
    const response = await enhancedFetch(`/api/fetchuserbalance/${gizmoId}`);
    const data = await response.json();
    return data.balance || 'Error fetching time';
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 'Error fetching time';
  }
};

export const fetchUserBalanceWithDebt = async (gizmoId) => {
  try {
    // Add cache-busting timestamp
    const timestamp = Date.now();
    const response = await fetch(`/api/fetchuserbalance/${gizmoId}?t=${timestamp}`, {
      ...fetchConfig,
      headers: {
        ...fetchConfig.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (!response.ok) {
      return {
        balance: 'Error fetching time',
        hasDebt: false,
        debtAmount: 0,
        rawBalance: 0
      };
    }
    const data = await response.json();
    return {
      balance: data.balance || 'Error fetching time',
      hasDebt: data.hasDebt || false,
      debtAmount: data.debtAmount || 0,
      rawBalance: data.rawBalance || 0
    };
  } catch (error) {
    return {
      balance: 'Error fetching time',
      hasDebt: false,
      debtAmount: 0,
      rawBalance: 0
    };
  }
};

export const fetchUserById = async (gizmoId) => {
  try {
    const response = await fetch(`/api/fetchUserById/${gizmoId}`, fetchConfig);
    if (!response.ok) throw new Error('Error fetching user by ID');
    const data = await response.json();
    return data.result;
  } catch (error) {
    return null;
  }
};

export const fetchTopUsers = async (numberOfUsers = 10) => {
  console.log('fetchTopUsers called');
  try {
    console.log('Making request to /api/fetchtopusers');
    // Add cache-busting timestamp
    const timestamp = Date.now();
    const response = await fetch(`/api/fetchtopusers?numberOfUsers=${numberOfUsers}&t=${timestamp}`, {
      ...fetchConfig,
      headers: {
        ...fetchConfig.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
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
    const response = await fetch(
      `/api/returngizmoid?username=${encodeURIComponent(username)}`,
      fetchConfig
    );
    if (!response.ok) throw new Error('Failed to fetch Gizmo ID');
    const data = await response.json();
    return { gizmoId: data.gizmoId };
  } catch (error) {
    console.error('Error in fetchGizmoId:', error);
    return { gizmoId: null };
  }
};

export const fetchUserPoints = async (gizmoId) => {
  // Check if user is authenticated first
  const isAuth = await isUserAuthenticated();
  if (!isAuth) {
    console.warn('User not authenticated, skipping points fetch');
    return { points: 0, success: false };
  }

  // Add cache-busting timestamp
  const timestamp = Date.now();
  const url = `/api/points/${gizmoId}?t=${timestamp}`;
  try {
    console.log(`Fetching user points from URL: ${url}`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(url, {
      ...fetchConfig,
      headers: {
        ...authHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Authentication required for points fetch');
        return { points: 0, success: false };
      }
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
    return { points: 0, success: false };
  }
};

export const fetchUserTimeInfo = async (gizmoId) => {
  try {
    // Add cache-busting timestamp
    const timestamp = Date.now();
    const response = await fetch(`/api/users/${gizmoId}/producttimeextended?t=${timestamp}`, {
      ...fetchConfig,
      headers: {
        ...fetchConfig.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
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
      entry && !entry.isDepleted && !entry.isVoided && !entry.isDeleted && !entry.isExpired
    );

    // Calculate total time from all valid entries
    const totalSeconds = validEntries.reduce((total, entry) => {
      if (!entry) return total;
      return total + (entry.secondsLeft || 0);
    }, 0);

    // Convert seconds to hours and minutes
    const formatTime = (seconds) => ({
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor((seconds % 3600) / 60)
    });

    return {
      total: formatTime(totalSeconds)
    };
  } catch (error) {
    console.error('Error fetching user time info:', error);
    // Return default values on error
    return {
      total: { hours: 0, minutes: 0 }
    };
  }
};

const fetchUserData = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id);

    if (error) throw error;

    console.log('User data:', data);
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
};

export const fetchTopClipOfWeek = async (supabase) => {
  try {
    // Add safety check
    if (!supabase?.from) {
      console.error('Supabase client is not properly initialized');
      return null;
    }

    // Get the start and end of the current week
    const now = new Date();
    
    // Calculate start of week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Calculate end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const { data: clips, error } = await supabase
      .from('clips')
      .select('*')
      .eq('visibility', 'public')
      .gte('uploaded_at', startOfWeek.toISOString())
      .lte('uploaded_at', endOfWeek.toISOString())
      .order('likes_count', { ascending: false })
      .order('uploaded_at', { ascending: true })
      .limit(1);

    if (error) throw error;

    if (!clips?.length) return null;

    // Get video URL and thumbnail URL
    const supabaseClient = getSupabase();
    if (!supabaseClient) throw new Error('Supabase client not available');
    const { data: videoData } = await supabaseClient.storage
      .from('highlight-clips')
      .getPublicUrl(clips[0].file_path);

    let thumbnailUrl = null;
    if (clips[0].thumbnail_path) {
      const { data: thumbnailData } = await supabaseClient.storage
        .from('highlight-clips')
        .getPublicUrl(clips[0].thumbnail_path);
      thumbnailUrl = thumbnailData?.publicUrl;
    }

    return {
      ...clips[0],
      url: videoData?.publicUrl,
      thumbnailUrl: thumbnailUrl || videoData?.publicUrl
    };

  } catch (error) {
    console.error('Error fetching top clip:', error);
    return null;
  }
};

// Keep track of created blob URLs
const blobUrls = new Set();

export const fetchUserPicture = async (gizmoId) => {
  if (!gizmoId) {
    return null;
  }

  try {
    const response = await fetch(`/api/users/${gizmoId}/picture`);
    
    if (!response.ok) {
      return null;
    }

    // Check if response is JSON (no image case)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      // It's a JSON response, meaning no image
      const data = await response.json();
      if (!data.result) {
        return null;
      }
    }

    // If we get here, try to process as image
    try {
      const blob = await response.blob();
      if (!blob || blob.size < 100) {
        return null;
      }

      const url = URL.createObjectURL(blob);
      blobUrls.add(url);
      return url;
    } catch {
      return null;
    }

  } catch {
    return null;
  }
};

// Add cleanup function
export const cleanupBlobUrls = () => {
  blobUrls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error revoking blob URL:', error);
    }
  });
  blobUrls.clear();
};

export const uploadUserPicture = async (gizmoId, file) => {
  try {
    const resizedImage = await resizeImage(file, {
      maxWidth: 500,
      maxHeight: 500,
      quality: 1
    });

    const base64String = await imageToBase64(resizedImage);

    const response = await enhancedFetch(`/api/users/${gizmoId}/picture`, {
      method: 'PUT',
      body: JSON.stringify({ picture: base64String })
    });

    return true;
  } catch (error) {
    console.error('Error uploading picture:', error);
    return false;
  }
};

// Helper functions
const imageToBase64 = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result.split(',')[1]);
  reader.readAsDataURL(file);
});

// Helper function to resize images
const resizeImage = async (file, { maxWidth, maxHeight, quality }) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            }));
          },
          'image/jpeg',
          quality // This controls the compression (0.8 = 80% quality)
        );
      };
    };
  });
};

// Add this function to get client IP
export const getClientIP = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json', fetchConfig);
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP:', error);
    return '0.0.0.0'; // fallback IP
  }
};

export const fetchComputers = async () => {
  try {
    // Define your computers data structure
    const computers = {
      normal: Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        number: i + 1,
        isActive: false,
        timeLeft: 'No Time',
        type: 'normal'
      })),
      vip: Array.from({ length: 6 }, (_, i) => ({
        id: i + 9,
        number: i + 1,
        isActive: false,
        timeLeft: 'No Time',
        type: 'vip'
      }))
    };

    return computers;
  } catch (error) {
    console.error('Error in fetchComputers:', error);
    throw error;
  }
};

// Add this function to fetch a user's upcoming matches
export async function fetchUserUpcomingMatches(userId) {
  if (!userId) {
    console.error("fetchUserUpcomingMatches called without userId");
    return [];
  }

  try {
    console.log(`Calling upcoming-matches API for user ${userId}`);
    const response = await fetch(`/api/user/upcoming-matches?userId=${userId}`, {
      method: 'GET',
      headers: {
        ...fetchConfig.headers
      },
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch upcoming matches:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // If it's a database configuration error, return empty array gracefully
      if (response.status === 500 && errorText.includes('Database configuration error')) {
        console.warn('Database not configured for upcoming matches, returning empty array');
        return [];
      }
      
      // For other errors, still return empty array to prevent dashboard crashes
      return [];
    }

    const data = await response.json();
    console.log(`Retrieved ${data.matches?.length || 0} upcoming matches for user`);
    return data.matches || [];
  } catch (error) {
    console.error('Error fetching upcoming matches:', error);
    // Return empty array instead of throwing, to handle the error gracefully
    return [];
  }
}

// Fetch shift reports from Gizmo API
export const fetchShiftReports = async (dateFrom, dateTo, reportType = 2) => {
  try {
    // Format dates correctly for the API
    const formattedDateFrom = encodeURIComponent(dateFrom.toISOString());
    const formattedDateTo = encodeURIComponent(dateTo.toISOString());
    
    // Make request to our API endpoint that will handle authentication
    const response = await fetch(
      `/api/reports/shiftslog?dateFrom=${formattedDateFrom}&dateTo=${formattedDateTo}&reportType=${reportType}`,
      fetchConfig
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shift reports fetch failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch shift reports: ${response.status}`);
    }

    // Return the complete response data
    const data = await response.json();
    return data; // This includes version, result, httpStatusCode, message, isError
  } catch (error) {
    console.error('Error fetching shift reports:', error);
    throw error;
  }
};

// Add the login user to computer function near other user-related functions

export const loginUserToComputer = async (gizmoId, hostId) => {
  try {
    // Validate parameters
    if (!gizmoId || !hostId) {
      console.error('Missing required parameters for loginUserToComputer', { gizmoId, hostId });
      return { 
        success: false, 
        error: 'Missing user ID or host ID'
      };
    }

    // Check if user is authenticated first
    const isAuth = await isUserAuthenticated();
    if (!isAuth) {
      console.warn('User not authenticated, cannot login to computer');
      return { 
        success: false, 
        error: 'Authentication required'
      };
    }

    console.log(`Logging in user ${gizmoId} to host ${hostId}`);
    
    // Call our API endpoint with authentication
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`/api/users/${gizmoId}/login/${hostId}`, {
      method: 'POST',
      headers: {
        ...authHeaders
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('Authentication/authorization required for computer login');
        return {
          success: false,
          error: 'Authentication required',
          status: response.status
        };
      }
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error(`Failed to login user to computer: ${response.status}`, errorData);
      return {
        success: false,
        error: errorData.message || `Server error: ${response.status}`,
        status: response.status
      };
    }

    const data = await response.json();
    console.log('Login successful:', data);
    
    return {
      success: true,
      result: data.result,
      message: data.message || 'User logged in successfully'
    };
  } catch (error) {
    console.error('Error in loginUserToComputer:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};

/**
 * Add game time to a user as a reward
 * @param {string} gizmoId - The user's Gizmo ID
 * @param {number} seconds - Amount of time to add in seconds
 * @returns {Promise<object>} - Result of the operation
 */
export const addGameTimeToUser = async (gizmoId, seconds) => {
  try {
    if (!gizmoId || !seconds) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    // IMPORTANT FIX: The API appears to be treating the seconds value as MINUTES
    // Divide by 60 to get the correct amount of time (1 hour = 60 minutes)
    const apiAmount = Math.round(seconds / 60);
    
    console.log(`[AMOUNT DEBUG] Original request: ${seconds} seconds (${seconds/3600} hours)`);
    console.log(`[AMOUNT DEBUG] CORRECTED amount: ${apiAmount} units (should be 60 minutes = 1 hour)`);
    
    // Generate a unique request ID to track this specific request
    const requestId = Date.now().toString();
    console.log(`[AMOUNT DEBUG] Request ID: ${requestId}`);

    // Use the correct URL path structure with price=0 (free)
    // But use the corrected amount parameter
    const apiUrl = `/api/users/${gizmoId}/order/time/${apiAmount}/price/0/invoice`;
    console.log(`[AMOUNT DEBUG] Calling endpoint: ${apiUrl}`);
    
    // Read the current Supabase session token from local storage (client only)
    let authHeader = {};
    try {
      if (typeof window !== 'undefined') {
        const supabaseClient = getSupabase();
        if (!supabaseClient) return {};
        const { data } = await supabaseClient.auth.getSession();
        const accessToken = data?.session?.access_token;
        if (accessToken) {
          authHeader = { Authorization: `Bearer ${accessToken}` };
        }
      }
    } catch {}

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...fetchConfig.headers,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...authHeader
      },
      // Use empty object as body
      body: JSON.stringify({})
    });

    // First get the response as text
    const responseText = await response.text();
    console.log(`[AMOUNT DEBUG] Raw response for request ${requestId}:`, responseText.substring(0, 200));
    
    // Then try to parse it as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error(`[AMOUNT DEBUG] Invalid JSON response for request ${requestId}:`, responseText);
      return {
        success: false,
        error: `Invalid response: ${responseText.substring(0, 100)}`
      };
    }

    if (!response.ok) {
      console.error(`[AMOUNT DEBUG] Request ${requestId} failed: ${response.status}`, data);
      return {
        success: false,
        error: data.error || `Server error: ${response.status}`,
        details: data.details,
        status: response.status
      };
    }
    
    console.log(`[AMOUNT DEBUG] Request ${requestId} successful - added ${apiAmount} units to user ${gizmoId}`);
    
    return {
      success: true,
      result: data.result,
      message: data.message || 'Game time added successfully'
    };
  } catch (error) {
    console.error('[AMOUNT DEBUG] Error adding game time:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};
