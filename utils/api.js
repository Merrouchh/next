import { createClient } from '../utils/supabase/component';
const supabase = createClient();

// utils/api.js
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;

const fetchConfig = {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'application/json'
  },
  cache: 'no-store',
  next: { revalidate: 0 }
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
    
    const response = await fetch('/api/validateUserCredentials', {
      ...fetchConfig,
      method: 'POST',
      body: JSON.stringify({ username, password }),
      credentials: 'same-origin', // Include cookies for session handling
      cache: 'no-store', // Prevent caching issues in Safari/Brave
    });

    if (!response.ok) {
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
    return { 
      isValid: false,
      error: error.message || 'Connection error',
      isConnectionError: true
    };
  }
};
    
export const fetchActiveUserSessions = async () => {
  try {
    const response = await fetch('/api/fetchactivesessions', fetchConfig);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await response.json();
    return data.result || [];
  } catch (error) {
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
    const response = await fetch(`/api/fetchuserbalance/${gizmoId}`, fetchConfig);
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
    const response = await fetch(`/api/fetchtopusers?numberOfUsers=${numberOfUsers}`, fetchConfig);
    
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
  const url = `/api/points/${gizmoId}`;
  try {
    console.log(`Fetching user points from URL: ${url}`);
    const response = await fetch(url, fetchConfig);
    
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
    const response = await fetch(`/api/users/${gizmoId}/producttimeextended`, fetchConfig);
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
    const { data: videoData } = await supabase.storage
      .from('highlight-clips')
      .getPublicUrl(clips[0].file_path);

    let thumbnailUrl = null;
    if (clips[0].thumbnail_path) {
      const { data: thumbnailData } = await supabase.storage
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
      throw new Error(`Failed to fetch upcoming matches: ${response.status} ${errorText}`);
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

    console.log(`Logging in user ${gizmoId} to host ${hostId}`);
    
    // Call our API endpoint
    const response = await fetch(`/api/users/${gizmoId}/login/${hostId}`, {
      method: 'POST',
      headers: {
        ...fetchConfig.headers
      }
    });

    if (!response.ok) {
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
