export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Username, current password, and new password are required' });
  }

  // First verify current credentials
  try {
    // Verify current password
    const validationUrl = `${process.env.API_BASE_URL}/users/${encodeURIComponent(username)}/${encodeURIComponent(currentPassword)}/valid`;
    
    const validationResponse = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(process.env.API_AUTH).toString('base64'),
      },
    });

    if (!validationResponse.ok) {
      console.error(`Validation error: ${validationResponse.status}`);
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const validationData = await validationResponse.json();
    if (!validationData?.result?.result === 0) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    const updateUrl = `${process.env.API_BASE_URL}/users/${validationData.result.identity.userId}/password`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(process.env.API_AUTH).toString('base64'),
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!updateResponse.ok) {
      console.error(`Update error: ${updateResponse.status}`);
      return res.status(updateResponse.status).json({ message: 'Failed to update password' });
    }

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating gaming password:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
} 