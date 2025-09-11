export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { gizmoId } = req.query;
    const apiUrl = `${process.env.API_BASE_URL}/users/${gizmoId}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`,
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ message: 'Failed to fetch user by ID' });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
} 