import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req, res) {
  // Handle GET requests (for webhook verification)
  if (req.method === 'GET') {
    // Your verify token from WhatsApp configuration
    const VERIFY_TOKEN = "merrouchgaming2024";
    
    // Parse query parameters
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Check if a token and mode were sent
    if (mode && token) {
      // Check the mode and token sent are correct
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        // Respond with 200 OK and challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.status(403).end();
      }
    }
  }

  // Handle POST requests (for receiving messages)
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Check if this is a WhatsApp message
      if (body.object === 'whatsapp_business_account') {
        // Process the message here
        console.log('Received webhook:', JSON.stringify(body, null, 2));
        
        // Send a 200 OK response back to WhatsApp
        res.status(200).json({ received: true });
      } else {
        // Not a WhatsApp message
        res.status(404).end();
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Error processing webhook' });
    }
  }
} 