-- Create security_events table for audit logging
-- This table stores security-related events like unauthorized access attempts

CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    attempted_path TEXT,
    details JSONB,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events (user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events (severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events (created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events (ip_address);

-- Enable Row Level Security
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read security events
CREATE POLICY "Admins can read security events" ON public.security_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create policy: Only service role can insert security events
CREATE POLICY "Service role can insert security events" ON public.security_events
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.security_events TO authenticated;
GRANT INSERT ON public.security_events TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.security_events IS 'Audit log for security-related events including unauthorized access attempts';
COMMENT ON COLUMN public.security_events.event_type IS 'Type of security event (e.g., unauthorized_admin_access, api_abuse)';
COMMENT ON COLUMN public.security_events.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN public.security_events.details IS 'Additional context stored as JSON';
