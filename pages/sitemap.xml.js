const EXTERNAL_DATA_URL = 'https://merrouchgaming.com';
import { createClient } from '@supabase/supabase-js';

async function fetchAllClips(supabase) {
  console.log('Starting to fetch public clips for sitemap...');
  const BATCH_SIZE = 1000;
  let allClips = [];
  let page = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const from = page * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;
      
      console.log(`Fetching clips batch ${page + 1}, range ${from}-${to}`);
      
      const { data: clips, error } = await supabase
        .from('clips')
        .select(`
          id,
          uploaded_at,
          title,
          username,
          cloudflare_uid,
          thumbnail_path
        `)
        .eq('visibility', 'public')
        .not('cloudflare_uid', 'is', null) // Ensure we have valid UIDs for video schema
        .order('uploaded_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error('Error fetching clips for sitemap:', error);
        break;
      }
      
      if (clips && clips.length > 0) {
        allClips = [...allClips, ...clips];
        page++;
        
        // Check if we likely have more results
        if (clips.length < BATCH_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Successfully fetched ${allClips.length} public clips for sitemap`);
    return allClips;
  } catch (error) {
    console.error('Failed to fetch clips for sitemap:', error);
    return [];
  }
}

async function generateSiteMap() {
  console.log('Starting sitemap generation...');
  
  try {
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables for sitemap generation');
      console.log('NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const lastMod = new Date().toISOString();

    // Fetch all public clips using pagination
    const clips = await fetchAllClips(supabase);

    // Process clips to use Cloudflare Stream URLs
    const processedClips = clips?.map(clip => ({
      ...clip,
      // Use Cloudflare Stream thumbnail URL directly
      thumbnail_url: `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`,
      // Fallback to stored thumbnail if needed
      fallback_thumbnail: clip.thumbnail_path || null,
      // Use Cloudflare Stream player URL
      player_url: `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/watch`,
      // Default duration since it's not in the database
      duration: 30
    }));

    // Fetch only users who have public clips
    const { data: users } = await supabase
      .from('clips')
      .select('username')
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false });

    // Get unique usernames
    const uniqueUsers = [...new Set(users?.map(user => user.username))];
    
    // Fetch all events data for sitemap
    const { data: events } = await supabase
      .from('events')
      .select(`
        id,
        title,
        date,
        status,
        image
      `)
      .order('date', { ascending: false });

    console.log(`Generated sitemap with ${processedClips?.length || 0} clips, ${uniqueUsers?.length || 0} user profiles, and ${events?.length || 0} events`);

    return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
           xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
           xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
     <!-- Public Pages -->
     <url>
       <loc>${EXTERNAL_DATA_URL}</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>daily</changefreq>
       <priority>1.0</priority>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/shop</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>weekly</changefreq>
       <priority>0.8</priority>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/discover</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>daily</changefreq>
       <priority>0.9</priority>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/events</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>daily</changefreq>
       <priority>0.9</priority>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/topusers</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>hourly</changefreq>
       <priority>0.7</priority>
     </url>

     <!-- Events Pages -->
     ${events ? events.map(event => {
       // Format the date for lastmod
       const eventDate = event.date ? new Date(event.date).toISOString() : lastMod;
       
       // Determine change frequency based on event status
       let changeFreq = 'weekly';
       if (event.status === 'Upcoming') {
         changeFreq = 'daily';
       } else if (event.status === 'In Progress') {
         changeFreq = 'hourly';
       }
       
       // Determine priority based on event status
       let priority = '0.7';
       if (event.status === 'Upcoming') {
         priority = '0.8';
       } else if (event.status === 'In Progress') {
         priority = '0.9';
       }
       
       return `
       <url>
         <loc>${EXTERNAL_DATA_URL}/events/${event.id}</loc>
         <lastmod>${eventDate}</lastmod>
         <changefreq>${changeFreq}</changefreq>
         <priority>${priority}</priority>
         ${event.image ? `
         <image:image>
           <image:loc>${event.image}</image:loc>
           <image:title>${event.title}</image:title>
           <image:caption>${event.title} - Gaming event at Merrouch Gaming Center</image:caption>
         </image:image>` : ''}
       </url>
       ${event.status === 'Completed' || event.status === 'In Progress' ? `
       <url>
         <loc>${EXTERNAL_DATA_URL}/events/${event.id}/bracket</loc>
         <lastmod>${eventDate}</lastmod>
         <changefreq>${event.status === 'In Progress' ? 'hourly' : 'monthly'}</changefreq>
         <priority>${event.status === 'In Progress' ? '0.9' : '0.6'}</priority>
       </url>` : ''}
     `}).join('') : ''}

     <!-- Public Clips -->
     ${processedClips ? processedClips.map(clip => {
       // Set upload date and escape XML special characters in title and description
       const uploadDate = new Date(clip.uploaded_at).toISOString();
       const safeTitle = clip.title ? clip.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;') : 'Gaming Clip';
       const safeDescription = `Gaming clip shared by ${clip.username} on Merrouch Gaming`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
       
       return `
       <url>
         <loc>${EXTERNAL_DATA_URL}/clip/${clip.id}</loc>
         <lastmod>${uploadDate}</lastmod>
         <changefreq>weekly</changefreq>
         <priority>0.7</priority>
         <video:video>
           <video:thumbnail_loc>${clip.thumbnail_url}</video:thumbnail_loc>
           <video:title>${safeTitle}</video:title>
           <video:description>${safeDescription}</video:description>
           <video:player_loc allow_embed="yes">https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/watch</video:player_loc>
           <video:duration>${clip.duration}</video:duration>
           <video:publication_date>${uploadDate}</video:publication_date>
           <video:family_friendly>yes</video:family_friendly>
           <video:live>no</video:live>
           <video:platform relationship="allow">web</video:platform>
           <video:platform relationship="allow">mobile</video:platform>
           <video:requires_subscription>no</video:requires_subscription>
           <video:uploader
             info="${EXTERNAL_DATA_URL}/profile/${clip.username}"
           >${clip.username}</video:uploader>
         </video:video>
       </url>
     `}).join('') : ''}

     <!-- Users with Public Clips -->
     ${uniqueUsers ? uniqueUsers.map(username => `
       <url>
         <loc>${EXTERNAL_DATA_URL}/profile/${username}</loc>
         <lastmod>${lastMod}</lastmod>
         <changefreq>daily</changefreq>
         <priority>0.6</priority>
       </url>
     `).join('') : ''}
   </urlset>`;
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return a basic sitemap with just the main pages in case of error
    return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${EXTERNAL_DATA_URL}</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>${EXTERNAL_DATA_URL}/discover</loc>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
      </url>
      <url>
        <loc>${EXTERNAL_DATA_URL}/events</loc>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
      </url>
    </urlset>`;
  }
}

export async function getServerSideProps({ res }) {
  const startTime = Date.now();
  try {
    console.log('Sitemap requested, generating...');
    const sitemap = await generateSiteMap();
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    
    // Write sitemap to response
    res.write(sitemap);
    res.end();
    
    // Log timing information
    const duration = Date.now() - startTime;
    console.log(`Sitemap generation completed in ${duration}ms`);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).end();
  }

  return {
    props: {},
  };
}

export default function Sitemap() {
  return null;
}