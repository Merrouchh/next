export default async function handler(req, res) {
  const { gizmoId } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiUrl = `${process.env.API_BASE_URL}/users/${gizmoId}/balance`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ message: 'Failed to fetch user balance' });
    }

    const data = await response.json();
    const availableTime = data.result?.availableTime || 0;
    const totalHours = Math.abs(availableTime) / 3600;
    const hours = Math.floor(totalHours);
    const minutes = Math.floor((totalHours - hours) * 60);
    
    const balance = data.result?.balance || 0;

    return res.status(200).json({
      balance: availableTime <= 0 ? 'No Time Left' : `${hours} : ${minutes}`,
      hasDebt: balance < 0,
      debtAmount: Math.abs(balance),
      rawBalance: balance
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
} 