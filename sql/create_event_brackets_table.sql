-- Create event_brackets table for storing tournament bracket data
CREATE TABLE IF NOT EXISTS event_brackets (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    matches JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(event_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_brackets_event_id ON event_brackets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_brackets_created_at ON event_brackets(created_at);

-- Add RLS policies
ALTER TABLE event_brackets ENABLE ROW LEVEL SECURITY;

-- Policy for admins and staff to read all brackets
CREATE POLICY "Admins and staff can read all brackets" ON event_brackets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Policy for admins and staff to insert brackets
CREATE POLICY "Admins and staff can insert brackets" ON event_brackets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Policy for admins and staff to update brackets
CREATE POLICY "Admins and staff can update brackets" ON event_brackets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Policy for admins and staff to delete brackets
CREATE POLICY "Admins and staff can delete brackets" ON event_brackets
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_staff = true)
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_brackets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_brackets_updated_at
    BEFORE UPDATE ON event_brackets
    FOR EACH ROW
    EXECUTE FUNCTION update_event_brackets_updated_at();
