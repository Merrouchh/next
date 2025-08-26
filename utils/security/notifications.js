/**
 * Security Notification System
 * Handles logging and alerting for security events
 */

import { createServiceRoleClient } from '../supabase/secure-server';
import { createClient } from '@supabase/supabase-js';

/**
 * Log security events to database and console
 */
export async function logSecurityEvent(event) {
  const {
    type,           // 'unauthorized_admin_access', 'unauthorized_staff_access', etc.
    user_id,        // User ID if available
    username,       // Username if available  
    ip_address,     // Client IP
    user_agent,     // Browser/client info
    attempted_path, // Path user tried to access
    details,        // Additional details
    severity = 'medium' // low, medium, high, critical
  } = event;

  try {
    // Log to console with proper formatting
    const timestamp = new Date().toISOString();
    const logLevel = severity === 'critical' ? 'error' : 'warn';
    
    console[logLevel](`[SECURITY ALERT] ${timestamp}`, {
      type,
      user: username || 'unknown',
      user_id,
      ip_address,
      attempted_path,
      severity,
      details
    });

    // Store in database for audit trail (if table exists)
    try {
      let supabase;
      
      // Try service role client first, fallback to regular client
      try {
        supabase = createServiceRoleClient();
      } catch (serviceRoleError) {
        console.debug('Service role not available, using regular client:', serviceRoleError.message);
        
        // Fallback to regular Supabase client with public keys
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('No Supabase credentials available');
        }
        
        // Use regular client for server-side logging (not SSR client)
        // Direct import to avoid any SSR client confusion
        supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
      }
      
      const { error: insertError } = await supabase
        .from('security_events')
        .insert({
          event_type: type,
          user_id,
          username,
          ip_address,
          user_agent,
          attempted_path,
          details,
          severity,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.warn('Failed to store security event in database:', insertError);
        console.warn('This might be due to RLS policies - consider using service role key for security logging');
      } else {
        console.log(`✅ Security event logged: ${type} by ${username || 'unknown'}`);
      }
    } catch (dbError) {
      // Database logging is optional - don't fail if table doesn't exist
      console.debug('Security events table not available:', dbError.message);
    }

    // For critical events, you could add additional alerting here:
    // - Send email/SMS to admins
    // - Post to Slack/Discord webhook
    // - Trigger external monitoring system
    
    if (severity === 'critical') {
      console.error(`🚨 CRITICAL SECURITY ALERT: ${type} by ${username || 'unknown user'}`);
      // TODO: Add email/SMS notifications for critical events
    }

  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Helper function for unauthorized admin access attempts
 */
export function logUnauthorizedAdminAccess(user, req) {
  return logSecurityEvent({
    type: 'unauthorized_admin_access',
    user_id: user?.id,
    username: user?.username || 'unknown',
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    user_agent: req.headers['user-agent'],
    attempted_path: req.url,
    details: `User without admin privileges attempted to access admin page`,
    severity: 'high'
  });
}

/**
 * Helper function for unauthorized staff access attempts
 */
export function logUnauthorizedStaffAccess(user, req) {
  return logSecurityEvent({
    type: 'unauthorized_staff_access',
    user_id: user?.id,
    username: user?.username || 'unknown',
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    user_agent: req.headers['user-agent'],
    attempted_path: req.url,
    details: `User without staff privileges attempted to access staff page`,
    severity: 'high'
  });
}

/**
 * Helper function for API abuse attempts
 */
export function logApiAbuse(user, req, details) {
  return logSecurityEvent({
    type: 'api_abuse',
    user_id: user?.id,
    username: user?.username || 'anonymous',
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    user_agent: req.headers['user-agent'],
    attempted_path: req.url,
    details,
    severity: 'critical'
  });
}

