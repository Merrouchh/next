import { NextApiRequest, NextApiResponse } from 'next';
import { sendWhatsAppMessage } from '../../../utils/whatsapp';

export default async function handler(req, res) {
  // Add a test endpoint
  if (req.method === 'GET' && req.query.test === 'true') {
    return res.status(200).json({ status: 'webhook endpoint is working' });
  }

  // Handle GET requests (for webhook verification)
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "merrouchgaming2024";
    
    // Log the incoming verification attempt
    console.log('Verification attempt:', {
      mode: req.query["hub.mode"],
      token: req.query["hub.verify_token"],
      challenge: req.query["hub.challenge"]
    });

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
      } else {
        console.log("VERIFICATION_FAILED", { 
          expectedToken: VERIFY_TOKEN, 
          receivedToken: token 
        });
        return res.status(403).end();
      }
    }

    // If no mode or token, return 400
    return res.status(400).json({ error: 'Missing mode or token' });
  }

  // Handle POST requests (for receiving messages)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Received webhook body:', body);

      if (body.object === 'whatsapp_business_account') {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
          const message = body.entry[0].changes[0].value.messages[0];
          console.log('Received message:', message);
        }
        return res.status(200).json({ received: true });
      }
      return res.status(404).json({ error: 'Not a WhatsApp message' });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Error processing webhook' });
    }
  }

  // Handle other methods
  return res.status(405).json({ error: 'Method not allowed' });
}

export async function sendWhatsAppMessage(req, res) {
  try {
    const result = await sendWhatsAppMessage('212656053641', 'hello_world');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 