import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req, res) {
  const topUsersNumber = parseInt(req.query.numberOfUsers, 10) || 10; // Use query parameter or default to 10

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() returns 0-11

  const dateFrom = new Date(year, month - 1, 0, 7, 0, 0).toISOString(); // 7:00 AM on the day before the first day of the current month
  const dateTo = new Date(year, month, 1, 7, 0, 0).toISOString(); // 7:00 AM on the first day of the next month

  const url = `${process.env.API_BASE_URL}/reports/topusers/${topUsersNumber}?TopUsersNumber=${topUsersNumber}&DateFrom=${encodeURIComponent(dateFrom)}&DateTo=${encodeURIComponent(dateTo)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching top users:', errorText); // Add this line
      return res.status(response.status).json({ error: `Error fetching top users: ${response.status} ${response.statusText}` });
    }

    const data = await response.json();
    console.log('API response (top users):', data); // Add this line
    const topSpenders = data.result.topSpenders[0].topUsers.slice(0, topUsersNumber); // Return the requested number of users
    res.status(200).json(topSpenders);
  } catch (error) {
    console.error('Internal Server Error:', error); // Add this line
    res.status(500).json({ error: 'Internal Server Error' });
  }
}


