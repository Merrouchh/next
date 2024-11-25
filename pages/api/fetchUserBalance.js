// pages/api/fetchUserBalance.js

export default async function handler(req, res) {
    const { userId } = req.query;

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const apiUrl = `${process.env.API_BASE_URL}/users/${userId}/balance`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                Authorization: 'Basic ' + btoa(process.env.API_AUTH),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in fetchUserBalance:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
