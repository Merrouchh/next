import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify admin access
async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user is admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (userError || !userData || !userData.is_admin) {
    throw new Error('Admin access required');
  }

  return user;
}

// Get username from Gizmo API
async function getGizmoUsername(gizmoId) {
  try {
    console.log('getGizmoUsername called with gizmoId:', gizmoId);
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    console.log('API config check:', { 
      hasApiUrl: !!apiUrl, 
      hasApiAuth: !!apiAuth,
      apiUrl: apiUrl ? 'set' : 'missing'
    });

    if (!apiUrl || !apiAuth) {
      console.error('Missing API configuration:', { apiUrl: !!apiUrl, apiAuth: !!apiAuth });
      throw new Error('Missing API configuration');
    }

    const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    console.log('Trying main user endpoint...');
    // Try the main user endpoint first
    const response = await fetch(`${apiUrl}/users/${gizmoId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('Main endpoint response:', { 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText 
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Main endpoint data:', data);
      
      if (data && data.result) {
        const username = data.result.name || data.result.username || data.result.userName || null;
        console.log('Extracted username from main endpoint:', username);
        if (username) {
          return username;
        }
      }
    }
    
    console.log('Trying user info endpoint...');
    // If first approach failed, try user info endpoint
    const infoResponse = await fetch(`${apiUrl}/users/${gizmoId}/info`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Info endpoint response:', { 
      status: infoResponse.status, 
      ok: infoResponse.ok,
      statusText: infoResponse.statusText 
    });
    
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      console.log('Info endpoint data:', infoData);
      
      if (infoData && infoData.result) {
        const username = infoData.result.name || infoData.result.username || infoData.result.userName || null;
        console.log('Extracted username from info endpoint:', username);
        if (username) {
          return username;
        }
      }
    }

    console.log('No username found from either endpoint');
    return null;
  } catch (error) {
    console.error('Error fetching Gizmo username:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    console.log('API called:', { method: req.method, url: req.url, query: req.query });
    
    await verifyAdmin(req.headers.authorization);
    console.log('Admin verification passed');
    
    switch (req.method) {
      case 'GET':
        return await handleGetUsers(req, res);
      case 'POST':
        return await handleSyncUsernames(req, res);
      case 'PUT':
        return await handleSyncSingleUser(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Username sync error:', error);
    console.error('Error stack:', error.stack);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Get all users with their current usernames and Gizmo IDs
async function handleGetUsers(req, res) {
  try {
    console.log('handleGetUsers called with query:', req.query);
    const { page = 1, limit = 10, search = '' } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    console.log('Fetching users with params:', { page, limit, search, offset });

    // First, get the total count of users with gizmo_id
    const { count: totalCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('gizmo_id', 'is', null);
    
    console.log('Total users with gizmo_id:', totalCount);

    // Now get all users with gizmo_id (we'll paginate in JavaScript for now)
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, username, gizmo_id, email, phone, created_at')
      .not('gizmo_id', 'is', null)
      .order('created_at', { ascending: false });

    if (allUsersError) {
      console.error('Database error:', allUsersError);
      throw allUsersError;
    }

    console.log('All users fetched:', allUsers?.length);

    // Apply search filter if provided
    let filteredUsers = allUsers || [];
    if (search) {
      const searchLc = String(search).toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        String(user.username || '').toLowerCase().includes(searchLc) ||
        String(user.email || '').toLowerCase().includes(searchLc)
      );
    }

    console.log('Filtered users:', filteredUsers.length);

    // Apply pagination manually
    const startIndex = offset;
    const endIndex = offset + limitNum;
    const users = filteredUsers.slice(startIndex, endIndex);
    const count = filteredUsers.length;

    console.log('Pagination applied:', { startIndex, endIndex, usersReturned: users.length });
    
    // Debug: Show the actual usernames being returned
    if (users && users.length > 0) {
      console.log('Users on this page:', users.map(u => ({ id: u.id, username: u.username, gizmo_id: u.gizmo_id })));
    }

    console.log('Final pagination calculation:', {
      totalUsers: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      limit: limitNum,
      usersReturned: users.length
    });

    return res.status(200).json({
      success: true,
      users: users || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      details: error.message
    });
  }
}

// Sync usernames for multiple users
async function handleSyncUsernames(req, res) {
  try {
    const { userIds, syncAll = false, backfillClips = false, backfillClipsOnly = false } = req.body;

    if (!backfillClipsOnly && !syncAll && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'User IDs are required for individual sync, or set syncAll to true'
      });
    }

    let targetUsers;
    
    if (syncAll) {
      // Get all users with Gizmo IDs
      const { data: allUsers, error: allUsersError } = await supabase
        .from('users')
        .select('id, username, gizmo_id')
        .not('gizmo_id', 'is', null);

      if (allUsersError) {
        throw allUsersError;
      }

      targetUsers = allUsers || [];
    } else {
      // Get specific users
      const { data: specificUsers, error: specificUsersError } = await supabase
        .from('users')
        .select('id, username, gizmo_id')
        .in('id', userIds)
        .not('gizmo_id', 'is', null);

      if (specificUsersError) {
        throw specificUsersError;
      }

      targetUsers = specificUsers || [];
    }

    const results = {
      total: targetUsers.length,
      synced: 0,
      failed: 0,
      updated: 0,
      unchanged: 0,
      clipsUpdated: 0,
      errors: []
    };

    // If backfill only, skip username sync and just update clips to match current users
    if (backfillClipsOnly) {
      // If specific userIds provided, limit to those; otherwise use targetUsers (all with gizmo_ids)
      const backfillUsers = targetUsers;
      for (const user of backfillUsers) {
        try {
          const { data: updatedClips, error: clipsUpdateError } = await supabase
            .from('clips')
            .update({ username: user.username })
            .eq('user_id', user.id)
            .select('id');

          if (clipsUpdateError) {
            results.errors.push({
              userId: user.id,
              username: user.username,
              error: `clips update failed: ${clipsUpdateError.message}`
            });
          } else {
            results.clipsUpdated += (updatedClips?.length || 0);
          }
        } catch (bfError) {
          console.error(`Error backfilling clips for user ${user.id}:`, bfError);
          results.errors.push({
            userId: user.id,
            username: user.username,
            error: bfError.message
          });
        }
      }
    } else {
      // Process each user: sync username from Gizmo, and optionally backfill clips if requested
      for (const user of targetUsers) {
        try {
          // Get current username from Gizmo
          const gizmoUsername = await getGizmoUsername(user.gizmo_id);
          
          if (!gizmoUsername) {
            results.failed++;
            results.errors.push({
              userId: user.id,
              username: user.username,
              error: 'Could not fetch username from Gizmo'
            });
            continue;
          }

          // Normalize the username (lowercase, trimmed)
          const normalizedGizmoUsername = gizmoUsername.trim().toLowerCase();
          const currentUsername = user.username;

          if (normalizedGizmoUsername === currentUsername) {
            results.unchanged++;
            if (backfillClips) {
              const { data: updatedClips, error: clipsUpdateError } = await supabase
                .from('clips')
                .update({ username: normalizedGizmoUsername })
                .eq('user_id', user.id)
                .select('id');

              if (clipsUpdateError) {
                results.errors.push({
                  userId: user.id,
                  username: user.username,
                  newUsername: normalizedGizmoUsername,
                  error: `clips update failed: ${clipsUpdateError.message}`
                });
              } else {
                results.clipsUpdated += (updatedClips?.length || 0);
              }
            }
          } else {
            // Update the username in the database
            const { error: updateError } = await supabase
              .from('users')
              .update({ 
                username: normalizedGizmoUsername
              })
              .eq('id', user.id);

            if (updateError) {
              results.failed++;
              results.errors.push({
                userId: user.id,
                username: user.username,
                newUsername: normalizedGizmoUsername,
                error: updateError.message
              });
            } else {
              // Also update username in clips for this user if requested
              const { data: updatedClips, error: clipsUpdateError } = await supabase
                .from('clips')
                .update({ username: normalizedGizmoUsername })
                .eq('user_id', user.id)
                .select('id');

              if (clipsUpdateError) {
                results.errors.push({
                  userId: user.id,
                  username: user.username,
                  newUsername: normalizedGizmoUsername,
                  error: `clips update failed: ${clipsUpdateError.message}`
                });
              } else {
                results.clipsUpdated += (updatedClips?.length || 0);
              }

              results.updated++;
              results.synced++;
            }
          }
        } catch (userError) {
          console.error(`Error syncing user ${user.id}:`, userError);
          results.failed++;
          results.errors.push({
            userId: user.id,
            username: user.username,
            error: userError.message
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: backfillClipsOnly
        ? `Clips backfill completed. ${results.clipsUpdated} clips updated.`
        : `Username sync completed. ${results.synced} users processed. ${backfillClips ? results.clipsUpdated : 0} clips updated.`,
      results
    });

  } catch (error) {
    console.error('Error in bulk username sync:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync usernames'
    });
  }
}

// Sync username for a single user
async function handleSyncSingleUser(req, res) {
  try {
    console.log('handleSyncSingleUser called with body:', req.body);
    const { userId } = req.body;

    if (!userId) {
      console.log('No userId provided');
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log('Fetching user data for userId:', userId);
    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, gizmo_id')
      .eq('id', userId)
      .single();

    console.log('User query result:', { user, error: userError });

    if (userError || !user) {
      console.log('User not found or error:', userError);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.gizmo_id) {
      console.log('User has no gizmo_id');
      return res.status(400).json({
        success: false,
        error: 'User does not have a Gizmo ID'
      });
    }

    console.log('Fetching username from Gizmo for gizmo_id:', user.gizmo_id);
    // Get current username from Gizmo
    const gizmoUsername = await getGizmoUsername(user.gizmo_id);
    
    console.log('Gizmo username result:', gizmoUsername);
    
    if (!gizmoUsername) {
      console.log('Could not fetch username from Gizmo');
      return res.status(400).json({
        success: false,
        error: 'Could not fetch username from Gizmo'
      });
    }

    // Normalize the username
    const normalizedGizmoUsername = gizmoUsername.trim().toLowerCase();
    const currentUsername = user.username;

    console.log('Username comparison:', { 
      current: currentUsername, 
      gizmo: normalizedGizmoUsername, 
      same: normalizedGizmoUsername === currentUsername 
    });

    if (normalizedGizmoUsername === currentUsername) {
      return res.status(200).json({
        success: true,
        message: 'Username is already up to date',
        data: {
          userId: user.id,
          currentUsername,
          gizmoUsername: normalizedGizmoUsername,
          updated: false,
          clipsUpdated: 0
        }
      });
    }

    console.log('Updating username in database...');
    // Update the username (without updated_at column for now)
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        username: normalizedGizmoUsername
      })
      .eq('id', user.id);

    console.log('Update result:', { error: updateError });

    if (updateError) {
      console.error('Database update error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update username',
        details: updateError.message
      });
    }

    // Also update username in clips for this user
    const { data: updatedClips, error: clipsUpdateError } = await supabase
      .from('clips')
      .update({ username: normalizedGizmoUsername })
      .eq('user_id', user.id)
      .select('id');

    if (clipsUpdateError) {
      console.error('Clips username update error:', clipsUpdateError);
    }

    console.log('Username updated successfully');
    return res.status(200).json({
      success: true,
      message: 'Username updated successfully',
      data: {
        userId: user.id,
        oldUsername: currentUsername,
        newUsername: normalizedGizmoUsername,
        updated: true,
        clipsUpdated: (updatedClips?.length || 0)
      }
    });

  } catch (error) {
    console.error('Error in single username sync:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync username',
      details: error.message
    });
  }
}
