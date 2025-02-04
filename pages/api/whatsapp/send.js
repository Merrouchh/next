import { sendWhatsAppMessage } from '../../../utils/whatsapp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, template = 'hello_world', language = 'en_US' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    const result = await sendWhatsAppMessage(to, template, language);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ error: error.message });
  }
} 