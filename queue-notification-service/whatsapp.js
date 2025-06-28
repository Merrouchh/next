const fetch = require('node-fetch');

/**
 * Send WhatsApp notification using Infobip templates
 */
async function sendWhatsAppQueueNotification(phoneNumber, templateType, params = {}) {
  if (!phoneNumber) {
    console.log('No phone number provided, skipping WhatsApp notification');
    return { success: false, reason: 'no_phone' };
  }

  try {
    // Format phone number (remove + if present for Infobip)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
    
    let payload;
    
    switch (templateType) {
      case 'queue_joined':
        // Template: client_queue - has {{1}} = userName, {{2}} = position
        payload = {
          messages: [
            {
              from: "447860098167",
              to: formattedPhone,
              content: {
                templateName: "client_queue",
                templateData: {
                  body: {
                    placeholders: [
                      params.userName || "there", // {{1}} - user name
                      params.position ? params.position.toString() : "1" // {{2}} - position number
                    ]
                  }
                },
                language: "en"
              }
            }
          ]
        };
        break;
        
      case 'your_turn':
        // Template: your_turn_has_come - has {{1}} = userName, static phone button
        const userName = params.userName || "there";
        
        payload = {
          messages: [
            {
              from: "447860098167",
              to: formattedPhone,
              content: {
                templateName: "your_turn_has_come",
                templateData: {
                  body: {
                    placeholders: [userName] // {{1}} - user name
                  }
                },
                language: "en"
              }
            }
          ]
        };
        break;
        
      default:
        throw new Error(`Unknown template type: ${templateType}`);
    }

    console.log(`📱 Sending WhatsApp ${templateType} notification to ${formattedPhone}`);

    // Call Infobip API
    const response = await fetch('https://m3y3xw.api.infobip.com/whatsapp/1/message/template', {
      method: 'POST',
      headers: {
        'Authorization': `App ${process.env.INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Error from Infobip API:', JSON.stringify(responseData, null, 2));
      throw new Error(`Failed to send WhatsApp message: ${responseData.error || responseData.message || 'Unknown error'}`);
    }

    console.log(`✅ WhatsApp ${templateType} notification sent successfully to ${formattedPhone}`);
    return { 
      success: true, 
      messageId: responseData.messages?.[0]?.messageId,
      response: responseData 
    };

  } catch (error) {
    console.error(`❌ Error sending WhatsApp ${templateType} notification:`, error);
    return { 
      success: false, 
      error: error.message,
      reason: 'send_failed' 
    };
  }
}

/**
 * Notify user when they join the queue
 */
async function notifyQueueJoined(phoneNumber, position, computerType = 'any', userName = 'there') {
  return await sendWhatsAppQueueNotification(phoneNumber, 'queue_joined', {
    userName,
    position,
    computerType
  });
}

/**
 * Notify user when it's their turn
 */
async function notifyYourTurn(phoneNumber, userName, computerType = 'any') {
  return await sendWhatsAppQueueNotification(phoneNumber, 'your_turn', {
    userName,
    computerType
  });
}

module.exports = {
  sendWhatsAppQueueNotification,
  notifyQueueJoined,
  notifyYourTurn
}; 