## Tournament Bracket Management

To implement the bracket management features, you need to create a new table in your Supabase database:

```sql
CREATE TABLE IF NOT EXISTS public.event_match_details (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  match_id INT NOT NULL,
  scheduled_time TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, match_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_match_details_event_id ON public.event_match_details (event_id);
```

This table stores additional information for each match in a tournament bracket, such as:
- Scheduled time for the match
- Physical location (e.g., "Station 3", "Main Stage")
- Additional notes

### Features implemented:

1. **Admin Bracket Manager** - A dedicated page at `/admin/events/brackets` where administrators can:
   - View all events with brackets
   - View matches for each event
   - Manage match details (time, location, notes)
   - Swap participants in matches (for seeding adjustments)

2. **Match Details Display** - The public bracket view now displays:
   - Scheduled match times
   - Match locations
   - Enhanced visual presentation

3. **API Endpoints** - New endpoints to support these features:
   - `GET /api/events/[id]/match-details` - Get all match details for an event
   - `POST /api/events/[id]/match-details` - Create match details
   - `PUT /api/events/[id]/match-details` - Update match details

### How to use:

1. Create the table in your Supabase database using the SQL above
2. Access the Bracket Manager from the Admin Events page
3. Select an event with a bracket to manage matches
4. Click on any match to add or edit details
5. Save changes for each match 