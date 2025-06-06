import { createClient } from '@supabase/supabase-js';
import { generateRandomCode } from '../../utils/auth';
import fetch from 'node-fetch';
import { markAchievementCompleted } from '../../lib/achievements/achievementService';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OTP expiration time in seconds (5 minutes)
const OTP_EXPIRY = 5 * 60;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { action, phone, code, userId } = req.body;

      console.log('Phone verification request:', { action, phone, userId });

      if (!phone || !userId) {
        return res.status(400).json({ error: 'Phone number and user ID are required' });
      }

      // Ensure phone is in E.164 format
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Phone number must be in E.164 format (e.g., +12125551234)' });
      }

      if (action === 'send') {
        // First check if this phone is already used by another account
        const { data: existingUserWithPhone, error: checkPhoneError } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .neq('id', userId)
          .maybeSingle();

        if (checkPhoneError) {
          console.error('Error checking for existing phone:', checkPhoneError);
        }

        if (existingUserWithPhone) {
          console.warn('Phone number already in use by another account:', existingUserWithPhone.id);
          return res.status(200).json({
            success: false,
            error: 'phone_already_used',
            message: 'This phone number is already associated with another account.'
          });
        }
        
        // Generate a 6-digit verification code
        const verificationCode = generateRandomCode(6);
        console.log('Generated verification code:', verificationCode, 'for phone:', phone);
        
        // Store the code and expiry time in the database
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + OTP_EXPIRY;
        
        // Check if there's an existing entry for this user/phone and update or create
        const { data: existingOtps, error: fetchError } = await supabase
          .from('phone_verification_codes')
          .select('*')
          .eq('user_id', userId)
          .eq('phone', phone);
          
        if (fetchError) {
          console.error('Error fetching existing OTPs:', fetchError);
          throw fetchError;
        }
        
        let insertOrUpdateError;
        
        if (existingOtps && existingOtps.length > 0) {
          console.log('Updating existing OTP for phone:', phone);
          // Update existing entry
          const { error } = await supabase
            .from('phone_verification_codes')
            .update({ 
              code: verificationCode,
              expires_at: expiresAt,
              attempts: 0,
              created_at: now
            })
            .eq('user_id', userId)
            .eq('phone', phone);
            
          insertOrUpdateError = error;
        } else {
          console.log('Creating new OTP entry for phone:', phone);
          // Insert new entry
          const { error } = await supabase
            .from('phone_verification_codes')
            .insert([
              { 
                user_id: userId,
                phone,
                code: verificationCode,
                expires_at: expiresAt,
                attempts: 0,
                created_at: now
              }
            ]);
            
          insertOrUpdateError = error;
        }
        
        if (insertOrUpdateError) {
          console.error('Error saving OTP to database:', insertOrUpdateError);
          throw insertOrUpdateError;
        }
        
        try {
          console.log('Sending WhatsApp verification code via Infobip');
          
          // Format phone number (remove + if present for Infobip)
          const formattedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
          
          // Create payload with COPY_CODE button based on the template in your screenshot
          const payload = {
            messages: [
              {
                from: "447860098167",
                to: formattedPhone,
                content: {
                  templateName: "verify_whatsapp_template_en",
                  templateData: {
                    body: {
                      placeholders: [verificationCode]
                    },
                    buttons: [
                      {
                        type: "URL",
                        parameter: verificationCode
                      }
                    ]
                  },
                  language: "en_GB"
                }
              }
            ]
          };
          
          console.log('Sending WhatsApp template with URL button payload (verification code as parameter):', JSON.stringify(payload, null, 2));
          
          // Call Infobip API directly
          const infobipResponse = await fetch('https://m3y3xw.api.infobip.com/whatsapp/1/message/template', {
            method: 'POST',
            headers: {
              'Authorization': `App ${process.env.INFOBIP_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          const infobipResponseData = await infobipResponse.json();
          
          if (!infobipResponse.ok) {
            console.error('Error from Infobip API:', JSON.stringify(infobipResponseData, null, 2));
            console.error('Response status:', infobipResponse.status);
            // Try to get more error details
            const errorDetails = infobipResponseData?.response?.error;
            throw new Error(`Failed to send WhatsApp message: ${infobipResponseData.error || infobipResponseData.message || errorDetails || 'Unknown error'}`);
          }
          
          console.log('WhatsApp message sent successfully');
          
          return res.status(200).json({ 
            success: true, 
            message: 'Verification code sent to WhatsApp'
          });
        } catch (infobipError) {
          console.error('Error sending WhatsApp message:', infobipError);
          
          // Delete the verification code since sending failed
          await supabase
            .from('phone_verification_codes')
            .delete()
            .eq('user_id', userId)
            .eq('phone', phone);
            
          throw new Error(`Failed to send WhatsApp message: ${infobipError.message}`);
        }
      } 
      else if (action === 'verify') {
        // Handle verification action
        if (!code) {
          return res.status(200).json({ 
            success: false,
            error: 'Verification code is required',
            message: 'Please enter your verification code.'
          });
        }
        
        console.log('Verifying code:', code, 'for phone:', phone);
        
        // Get the stored verification code
        const now = Math.floor(Date.now() / 1000);
        
        const { data: verificationData, error: fetchError } = await supabase
          .from('phone_verification_codes')
          .select('*')
          .eq('user_id', userId)
          .eq('phone', phone)
          .single();
          
        if (fetchError) {
          console.error('Error fetching verification code:', fetchError);
          return res.status(200).json({ 
            success: false,
            error: 'Verification code not found', 
            message: 'Verification code not found. Please request a new code.'
          });
        }
        
        console.log('Found verification data:', verificationData);
        
        // Check if code has expired
        if (verificationData.expires_at < now) {
          console.log('Code expired. Expires at:', verificationData.expires_at, 'Current time:', now);
          return res.status(200).json({ 
            success: false,
            error: 'Verification code has expired', 
            message: 'Verification code has expired. Please request a new code.' 
          });
        }
        
        // Check if too many failed attempts
        if (verificationData.attempts >= 5) {
          console.log('Too many attempts:', verificationData.attempts);
          return res.status(200).json({ 
            success: false,
            error: 'Too many failed attempts', 
            message: 'Too many failed attempts. Please request a new code.' 
          });
        }
        
        // Check if code matches
        if (verificationData.code !== code) {
          console.log('Invalid code. Expected:', verificationData.code, 'Got:', code);
          // Increment attempts
          const { error: updateError } = await supabase
            .from('phone_verification_codes')
            .update({ attempts: verificationData.attempts + 1 })
            .eq('id', verificationData.id);
            
          if (updateError) {
            console.error('Error updating attempts:', updateError);
          }
          
          return res.status(200).json({ 
            success: false,
            error: 'Invalid verification code',
            message: 'The verification code you entered is incorrect. Please try again.'
          });
        }
        
        console.log('Code verified successfully, updating user phone number');

        // Before updating, check if this phone is already used by another account
        const { data: existingUserWithPhone, error: checkPhoneError } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .neq('id', userId)
          .maybeSingle();

        if (checkPhoneError) {
          console.error('Error checking for existing phone:', checkPhoneError);
        }

        if (existingUserWithPhone) {
          console.warn('Phone number already in use by another account:', existingUserWithPhone.id);
          return res.status(200).json({
            success: false,
            error: 'phone_already_used',
            message: 'This phone number is already associated with another account.'
          });
        }

        // Update the auth user first - the users table will be updated automatically via triggers
        let authUpdateSuccess = false;
        try {
          console.log('Updating auth user phone number');
          
          // First try admin.updateUserById
          const { data: updateData, error: updateAuthError } = await supabase.auth.admin.updateUserById(
            userId,
            { phone }
          );
          
          if (updateAuthError) {
            console.error('Error updating auth user phone with admin API:', updateAuthError);
            
            // Check if this is a duplicate phone number error (phone already registered)
            // Supabase doesn't give specific error codes for this, so we need to make an educated guess
            const errorObj = updateAuthError?.error || updateAuthError;
            const errorMessage = errorObj?.message || updateAuthError.toString();
            const errorStatus = updateAuthError?.status || 500;
            
            // Error message or status that might indicate a duplicate phone
            if (
              errorStatus === 500 && 
              (errorMessage.includes('Error updating user') || 
               errorMessage.includes('unexpected_failure'))
            ) {
              console.log('Detected likely phone number conflict - this phone may already be in use');
              return res.status(200).json({
                success: false,
                error: 'phone_already_used',
                message: 'This phone number is already registered with another account. Please use a different phone number.'
              });
            }
            
            // Try a different method if admin API fails
            try {
              // Alternative approach using updateUser with admin flow
              const { error: altUpdateError } = await supabase.auth.updateUser(
                { phone },
                { 
                  authFlow: 'admin',
                  userId 
                }
              );
              
              if (altUpdateError) {
                console.error('Error with alternative update method:', altUpdateError);
                
                // Check for duplicate phone number in this error too
                const altErrorObj = altUpdateError?.error || altUpdateError;
                const altErrorMessage = altErrorObj?.message || altUpdateError.toString();
                
                if (
                  altUpdateError?.status === 400 || 
                  altErrorMessage.includes('Auth session missing') ||
                  altErrorMessage.includes('already exists')
                ) {
                  console.log('Alternate method also suggests phone number conflict');
                  return res.status(200).json({
                    success: false,
                    error: 'phone_already_used',
                    message: 'This phone number is already registered with another account. Please use a different phone number.'
                  });
                }
                
                // Auth update completely failed
                return res.status(500).json({ 
                  success: false, 
                  error: 'Failed to update phone number in auth system',
                  message: 'Unable to update your phone number. Please try again later.'
                });
              } else {
                console.log('Successfully updated auth user phone with alternative method');
                authUpdateSuccess = true;
              }
            } catch (altError) {
              console.error('Exception with alternative update:', altError);
              
              // Check for duplicate phone indication in the exception
              if (altError.message && (
                altError.message.includes('already exists') || 
                altError.message.includes('duplicate') ||
                altError.message.includes('Auth session missing')
              )) {
                return res.status(200).json({
                  success: false,
                  error: 'phone_already_used',
                  message: 'This phone number is already registered with another account. Please use a different phone number.'
                });
              }
              
              return res.status(500).json({ 
                success: false, 
                error: 'Exception updating phone number',
                message: 'An error occurred while updating your phone number. Please try again later.'
              });
            }
          } else {
            console.log('Successfully updated auth user phone with admin API');
            authUpdateSuccess = true;
          }
        } catch (authUpdateError) {
          console.error('Auth update error:', authUpdateError);
          return res.status(500).json({ 
            success: false, 
            error: 'Auth update failed',
            message: 'Failed to update your phone number. Please try again later.'
          });
        }
        
        if (!authUpdateSuccess) {
          return res.status(500).json({ 
            success: false, 
            error: 'Phone update failed',
            message: 'Unable to update your phone number in our system. Please contact support.'
          });
        }
        
        // Track that this phone has been verified for this user
        const { error: trackVerificationError } = await supabase
          .from('phone_verifications')
          .upsert({
            user_id: userId,
            phone: phone,
            verified_at: new Date().toISOString(),
            is_verified: true
          });
        
        if (trackVerificationError) {
          console.error('Error tracking phone verification:', trackVerificationError);
          // Non-fatal, continue with process
        }

        // Delete the verification code entry
        const { error: deleteError } = await supabase
          .from('phone_verification_codes')
          .delete()
          .eq('id', verificationData.id);

        if (deleteError) {
          console.error('Error deleting verification code:', deleteError);      
        }

        console.log('Phone number updated successfully in auth.users table');

        // Trigger phone achievement
        await markAchievementCompleted(supabase, userId, 'phone-verified');

        return res.status(200).json({
          success: true,
          message: 'Phone number verified and updated successfully'
        });
      } 
      else {
        return res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      
      // Detailed logging for debugging
      console.error('Error stack:', error.stack);
      
      // Try to extract error details
      let errorMessage = error.message || 'An error occurred during phone verification';
      let errorDetails = null;
      
      try {
        // Check if error has a response property (fetch error)
        if (error.response) {
          errorDetails = {
            status: error.response.status,
            statusText: error.response.statusText
          };
        }
        
        // Try to parse the error message if it's JSON
        if (typeof error.message === 'string' && error.message.includes('{')) {
          const jsonStart = error.message.indexOf('{');
          const jsonPart = error.message.substring(jsonStart);
          try {
            const parsedError = JSON.parse(jsonPart);
            errorDetails = parsedError;
          } catch (parseError) {
            // Ignore parse errors
          }
        }
      } catch (extractError) {
        console.error('Error extracting details:', extractError);
      }
      
      return res.status(500).json({ 
        error: 'An error occurred during phone verification',
        message: errorMessage,
        details: errorDetails,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 