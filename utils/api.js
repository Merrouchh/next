import { createClient } from '../utils/supabase/component';
const supabase = createClient();

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
    const response = await fetch('/api/fetchactivesessions');
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    return [];
  }
};

export const fetchUserBalance = async (gizmoId) => {
  try {
    const response = await fetch(`/api/fetchuserbalance/${gizmoId}`);
    if (!response.ok) {
      return 'Error fetching time';
    }
    const data = await response.json();
    return data.balance || 'Error fetching time';
  } catch (error) {
    return 'Error fetching time';
  }
};

export const fetchUserBalanceWithDebt = async (gizmoId) => {
  try {
    const response = await fetch(`/api/fetchuserbalance/${gizmoId}`);
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
    const response = await fetch(`/api/fetchUserById/${gizmoId}`);
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
    const response = await fetch(`/api/returngizmoid?username=${encodeURIComponent(username)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch Gizmo ID');
    }

    if (!data.gizmo_id) {
      throw new Error('No Gizmo ID returned');
    }

    return {
      gizmoId: data.gizmo_id,
      success: true
    };
  } catch (error) {
    return {
      gizmoId: null,
      success: false,
      error: error.message
    };
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
  // Get the start and end of the current week
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
  endOfWeek.setHours(23, 59, 59, 999);

  try {
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

    if (clips && clips.length > 0) {
      // Get video URL
      const { data: videoData } = supabase.storage
        .from('highlight-clips')
        .getPublicUrl(clips[0].file_path);

      // Get thumbnail URL if it exists
      let thumbnailUrl = null;
      if (clips[0].thumbnail_path) {
        const { data: thumbnailData } = supabase.storage
          .from('highlight-clips')
          .getPublicUrl(clips[0].thumbnail_path);
        thumbnailUrl = thumbnailData?.publicUrl;
      }

      return {
        ...clips[0],
        url: videoData?.publicUrl,
        thumbnailUrl: thumbnailUrl || videoData?.publicUrl
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching top clip:', error);
    return null;
  }
};

// Keep track of created blob URLs
const blobUrls = new Set();

export const fetchUserPicture = async (gizmoId) => {
  try {
    const response = await fetch(`/api/users/${gizmoId}/picture`);
    
    if (!response.ok) {
      console.error('Failed to fetch user picture:', response.status);
      return null;
    }

    // Check if the response is an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('image')) {
      console.error('Invalid content type for user picture:', contentType);
      return null;
    }

    // Create a blob URL directly from the response
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    
    // Track this URL for cleanup
    blobUrls.add(imageUrl);
    
    return imageUrl;

  } catch (error) {
    console.error('Error fetching user picture:', error);
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
    // Resize image before upload
    const resizedImage = await resizeImage(file, {
      maxWidth: 500,    // Maximum width of 500px
      maxHeight: 500,   // Maximum height of 500px
      quality: 1     // 80% quality compression
    });

    // Convert the image to base64 string
    const base64String = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(resizedImage);
    });

    const response = await fetch(`/api/users/${gizmoId}/picture`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        picture: base64String
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to upload picture');
    }

    return true;
  } catch (error) {
    console.error('Error uploading user picture:', error);
    return false;
  }
};

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
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP:', error);
    return '0.0.0.0'; // fallback IP
  }
};
