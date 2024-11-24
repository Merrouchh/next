// pages/api/fetchUserById/[userId].js
export default async function handler(req, res) {
    const { userId } = req.query;
    
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const apiUrl = `${process.env.API_BASE_URL}/users/${userId}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                Authorization: `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
            },
        });

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status}`);
            return res.status(response.status).json({ message: 'Failed to fetch user by ID' });
        }

        const data = await response.json();
        return res.status(200).json({ user: data.result });
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
