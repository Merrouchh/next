import { NextApiRequest, NextApiResponse } from 'next';

const fetchWithRetry = async (url, options, maxRetries = 3, delay = 2000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }

      // If it's a 522 error or other temporary failure
      if (response.status === 522 || response.status >= 500) {
        console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If it's another error, throw it immediately
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
};

export default async function handler(req, res) {
  const topUsersNumber = parseInt(req.query.numberOfUsers, 10) || 10;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const dateFrom = new Date(year, month - 1, 0, 7, 0, 0).toISOString();
  const dateTo = new Date(year, month, 1, 7, 0, 0).toISOString();

  const url = `${process.env.API_BASE_URL}/reports/topusers/${topUsersNumber}?TopUsersNumber=${topUsersNumber}&DateFrom=${encodeURIComponent(dateFrom)}&DateTo=${encodeURIComponent(dateTo)}`;

  try {
    const response = await fetchWithRetry(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('API response (top users):', data);
    const topSpenders = data.result.topSpenders[0].topUsers.slice(0, topUsersNumber);
    res.status(200).json(topSpenders);
  } catch (error) {
    console.error('Internal Server Error:', error);
    // Send a more specific error message
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Unable to fetch top users at the moment. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}


