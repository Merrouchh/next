export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { gizmoId } = req.query;

      if (!gizmoId) {
        return res.status(400).json({ error: 'Gizmo ID is required' });
      }

      const apiUrl = process.env.API_BASE_URL;
      const apiAuth = process.env.API_AUTH;

      if (!apiUrl || !apiAuth) {
        throw new Error('Missing API configuration');
      }

      const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
      const fullUrl = `${apiUrl}/users/${gizmoId}/picture`;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user picture: ${response.status}`);
      }

      // Forward all headers from the original response
      const headers = response.headers;
      headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Get the image data as a buffer
      const imageBuffer = await response.arrayBuffer();
      
      // Send the buffer directly
      res.send(Buffer.from(imageBuffer));

    } catch (error) {
      console.error('Error fetching user picture:', error);
      res.status(500).json({ error: 'Failed to fetch user picture' });
    }
  } 
  else if (req.method === 'PUT') {
    try {
      const { gizmoId } = req.query;
      const { picture } = req.body;

      if (!gizmoId) {
        return res.status(400).json({ error: 'Gizmo ID is required' });
      }

      if (!picture) {
        return res.status(400).json({ error: 'No picture data provided' });
      }

      const apiUrl = process.env.API_BASE_URL;
      const apiAuth = process.env.API_AUTH;

      if (!apiUrl || !apiAuth) {
        throw new Error('Missing API configuration');
      }

      const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
      const fullUrl = `${apiUrl}/users/${gizmoId}/picture`;

      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(picture)
      });

      if (!response.ok) {
        throw new Error(`Failed to upload picture: ${response.status}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error uploading picture:', error);
      res.status(500).json({ error: 'Failed to upload picture' });
    }
  } 
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 