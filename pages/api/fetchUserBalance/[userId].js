// pages/api/fetchUserBalance/[userId].js
export default async function handler(req, res) {
  const { userId } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiUrl = `${process.env.API_BASE_URL}/users/${userId}/balance`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
      },
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status}`);
      return res.status(response.status).json({ message: 'Failed to fetch user balance' });
    }

    const data = await response.json();
    const totalHours = data.result.availableTime / 3600;
    const hours = Math.floor(totalHours);
    const minutes = Math.floor((totalHours - hours) * 60);
    
    const balance = data.result.availableTime <= 0 ? 'No Time Left' : `${hours}h : ${minutes} min`;

    return res.status(200).json({ balance });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
