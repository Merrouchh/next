# Infobip WhatsApp Integration for Phone Verification

This document provides instructions for setting up WhatsApp verification with Infobip in the Merrouch Gaming application.

## Overview

We use Infobip's WhatsApp Business API to send verification codes to users when they want to add or update their phone numbers. This implementation uses WhatsApp template messages, which require pre-approval from WhatsApp.

## Prerequisites

1. An Infobip account with WhatsApp Business API access
2. An approved WhatsApp Business Account
3. A registered WhatsApp sender ID (+447860098167)
4. API key for Infobip
5. An approved message template for verification codes

## Setup Steps

### 1. Infobip Account Configuration

1. Sign up at [Infobip](https://www.infobip.com/) and log in to your account
2. Set up a WhatsApp Business Account 
3. Apply for WhatsApp Business API access
4. Create and note your API key from the Infobip dashboard
5. Set up your WhatsApp sender (phone number)
6. Create and get approval for a template message containing a verification code placeholder

### 2. Environment Variables

Set the following environment variables in your `.env.local` file:

```
INFOBIP_API_KEY=5dfe50985caebf7179e8f53d752d2c0e-3fa44ede-abb4-4a16-9461-23f8df9a42fb
INFOBIP_BASE_URL=https://m3y3xw.api.infobip.com
INFOBIP_WHATSAPP_SENDER=447860098167
INFOBIP_TEMPLATE_NAME=verify_whatsapp_template_en
INFOBIP_TEMPLATE_LANGUAGE=en_GB
```

* `INFOBIP_API_KEY`: Your Infobip API key
* `INFOBIP_BASE_URL`: The base URL for Infobip API (your specific API endpoint)
* `INFOBIP_WHATSAPP_SENDER`: Your WhatsApp sender ID/phone number (without the + prefix)
* `INFOBIP_TEMPLATE_NAME`: The name of your approved WhatsApp template
* `INFOBIP_TEMPLATE_LANGUAGE`: The language code for your template (e.g., en_GB)

### 3. WhatsApp Template Configuration

The template message should be approved by WhatsApp and contain at least one placeholder for the verification code. For example:

Template Name: `verify_whatsapp_template_en`
Template Content: `Your Merrouch Gaming verification code is: {{1}}. This code will expire in 5 minutes.`

Where `{{1}}` is a placeholder that will be replaced with the actual verification code.

### 4. Database Setup

Run the database migrations to create the necessary tables:

```bash
npx supabase migration up
```

This will create the `phone_verification_codes` table required for storing and verifying OTP codes.

## How It Works

1. When a user submits their phone number on the Edit Profile page, our system:
   - Validates the phone number format (E.164)
   - Verifies the user's identity by checking their password
   - Generates a random 6-digit verification code
   - Stores the code in the database with an expiration time
   - Sends the code via WhatsApp using Infobip's Template Message API

2. After the user receives the code on WhatsApp, they enter it in the verification form, and our system:
   - Validates the code against what's stored in the database
   - Updates the user's phone number if the code is correct
   - Handles error cases (expired codes, incorrect entries, etc.)

## API Integration Details

The integration uses the Infobip WhatsApp Business API endpoint:
```
https://m3y3xw.api.infobip.com/whatsapp/1/message/template
```

The payload structure for the API is:
```json
{
  "messages": [
    {
      "from": "447860098167",
      "to": "recipientPhoneNumber",
      "messageId": "unique-message-id",
      "content": {
        "templateName": "verify_whatsapp_template_en",
        "templateData": {
          "body": {
            "placeholders": ["verificationCode"]
          }
        },
        "language": "en_GB"
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues:

1. **WhatsApp messages not being delivered**: 
   - Ensure your Infobip account is properly set up for WhatsApp
   - Check that your WhatsApp template message is approved
   - Verify the recipient's phone number is in E.164 format
   - Confirm the template is being used correctly with valid placeholders

2. **API errors**:
   - Check the API key and credentials
   - Verify your account has sufficient credits
   - Look for detailed error messages in the server logs
   - Ensure the template name and language code are correct

3. **Verification failures**:
   - Ensure the database migration ran successfully
   - Check that the code entered matches the one sent
   - Verify the code hasn't expired (5-minute expiration)

## References

- [Infobip API Documentation](https://www.infobip.com/docs/api)
- [Infobip WhatsApp Business API](https://www.infobip.com/docs/whatsapp)
- [WhatsApp Template Message Guide](https://www.infobip.com/docs/api/channels/whatsapp/whatsapp-outbound-messages/send-whatsapp-template-message) 