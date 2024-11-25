// pages/api/users/[id]/balance.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    const { id } = req.query;
    try {
      const apiUrl = `${process.env.API_BASE_URL}/users/${id}/balance`;
      const response = await fetch(apiUrl, {
        headers: { Authorization: 'Basic ' + btoa(process.env.API_AUTH) },
      });
  
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
  
      const data = await response.json();
      return res.status(200).json({ balance: data.balance }); // Adjust based on API response structure
    } catch (error) {
      console.error(`Error fetching balance for user ${id}:`, error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
  