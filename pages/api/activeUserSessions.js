// pages/api/activeUserSessions.js
import { getAuthHeaders, buildApiUrl } from '../../utils/api'; // You need to implement these functions

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiUrl = buildApiUrl('/usersessions/active');
  
  try {
    const response = await fetch(apiUrl, { headers: getAuthHeaders() });
    
    if (!response.ok) {
      console.error('Error fetching active sessions');
      return res.status(500).json({ message: 'Error fetching active sessions' });
    }

    const data = await response.json();
    return res.status(200).json(data.result || []);
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
