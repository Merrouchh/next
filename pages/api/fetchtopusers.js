// Remove if not used
// const fetchWithRetry = async (url, options, maxRetries = 3, delay = 2000) => {

export default async function handler(req, res) {
  const topUsersNumber = parseInt(req.query.numberOfUsers, 10) || 10;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const dateFrom = new Date(year, month - 1, 0, 7, 0, 0).toISOString();
  const dateTo = new Date(year, month, 1, 7, 0, 0).toISOString();

  const url = `${process.env.API_BASE_URL}/reports/topusers/${topUsersNumber}?TopUsersNumber=${topUsersNumber}&DateFrom=${encodeURIComponent(dateFrom)}&DateTo=${encodeURIComponent(dateTo)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
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
  } finally {
    clearTimeout(timeout);
  }
}


