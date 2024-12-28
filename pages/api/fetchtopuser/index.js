import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req, res) {
  const { topUsersNumber } = req.query;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() returns 0-11

  const dateFrom = new Date(year, month - 1, 1, 7, 0, 0).toISOString(); // 7:00 AM on the first day of the current month
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
      return res.status(response.status).json({ error: `Error fetching top users: ${response.status} ${response.statusText}` });
    }

    const data = await response.json();
    const topSpenders = data.result.topSpenders[0].topUsers; // Extract top spenders
    res.status(200).json(topSpenders); // Return only top spenders
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
