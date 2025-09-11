-- Create event_match_details table for storing individual match information
CREATE TABLE IF NOT EXISTS event_match_details (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    match_id VARCHAR(255) NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    location VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(event_id, match_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_match_details_event_id ON event_match_details(event_id);
CREATE INDEX IF NOT EXISTS idx_event_match_details_match_id ON event_match_details(match_id);
CREATE INDEX IF NOT EXISTS idx_event_match_details_scheduled_time ON event_match_details(scheduled_time);

-- Add RLS policies
ALTER TABLE event_match_details ENABLE ROW LEVEL SECURITY;

-- Policy for admins and staff to read all match details
CREATE POLICY "Admins and staff can read all match details" ON event_match_details
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Policy for admins and staff to insert match details
CREATE POLICY "Admins and staff can insert match details" ON event_match_details
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Policy for admins and staff to update match details
CREATE POLICY "Admins and staff can update match details" ON event_match_details
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Policy for admins and staff to delete match details
CREATE POLICY "Admins and staff can delete match details" ON event_match_details
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_match_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_match_details_updated_at
    BEFORE UPDATE ON event_match_details
    FOR EACH ROW
    EXECUTE FUNCTION update_event_match_details_updated_at();
