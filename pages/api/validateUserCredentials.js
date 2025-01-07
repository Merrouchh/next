// pages/api/validateUserCredentials.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    const { username, password } = req.body; // Extract username and password
  
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
  
    const apiUrl = `${process.env.API_BASE_URL}/users/${encodeURIComponent(username)}/${encodeURIComponent(password)}/valid`;
  
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: 'Basic ' + btoa(process.env.API_AUTH), // Base64 encode auth
        },
      });
  
      if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        return res.status(response.status).json({ message: 'Failed to fetch user credentials' });
      }
  
      const data = await response.json();
      console.log('External API Response:', data);
  
      // Pass the data back to the client
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in validateUserCredentials:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
  