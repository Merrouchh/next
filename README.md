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

# View Tracking Implementation

## How to Apply the View Tracking Function

To enable view tracking in your application, you need to add the `increment_view_count` stored procedure to your Supabase database. 

### Option 1: Using Supabase Studio

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/20240517_add_view_tracking.sql`
5. Run the query

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to your project directory
cd your-project-directory

# Apply the migration
supabase db push
```

## How View Tracking Works

1. When a user watches a video for at least 5 seconds, the system calls the tracking function
2. The system checks if this view is a duplicate (same user viewed in the last 6 hours)
3. If not a duplicate, it records the view in the `clip_views` table and increments the counter
4. The view count is displayed in the UI

## Debugging View Tracking

If views are not being counted, check:

1. Open your browser console (F12) and look for errors
2. Check the server logs for any errors in the API endpoint
3. Verify that the stored procedure exists in your database
4. Make sure your Supabase credentials are correct

## Tables Used

View tracking uses two database tables:

1. `clips` - Stores the video information and the total view count
2. `clip_views` - Stores detailed information about each view

## Database Indexes

Make sure your database has these indexes for optimal performance:

```sql
CREATE INDEX IF NOT EXISTS idx_clip_views_visitor_id ON public.clip_views USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS idx_clip_views_fingerprint ON public.clip_views USING btree (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_clip_views_composite ON public.clip_views USING btree (clip_id, visitor_id, device_fingerprint, created_at);
CREATE INDEX IF NOT EXISTS idx_clip_views_clip_id ON public.clip_views USING btree (clip_id);
``` 