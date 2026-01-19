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
          thumbnail_path,
          mp4link
        `)
        .eq('visibility', 'public')
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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables for sitemap generation');
      console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
      console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
      throw new Error('Missing required environment variables');
    }
    
      const supabase = createClient(
    process.env.SUPABASE_URL,
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
      // Use MP4 link if available, otherwise fallback to Cloudflare Stream player URL
      player_url: clip.mp4link || `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/watch`,
      video_url: clip.mp4link, // Add direct video URL
      // Default duration since it's not in the database
      duration: 30
    }));

    // Fetch users with engagement metrics to prioritize profiles
    // Include ALL profiles but prioritize by quality (best profiles first in sitemap)
    const { data: userClips } = await supabase
      .from('clips')
      .select('username, views_count, likes_count')
      .eq('visibility', 'public');

    // Calculate engagement metrics per user
    const userStats = {};
    if (userClips) {
      userClips.forEach(clip => {
        if (!userStats[clip.username]) {
          userStats[clip.username] = {
            username: clip.username,
            clipsCount: 0,
            totalViews: 0,
            totalLikes: 0
          };
        }
        userStats[clip.username].clipsCount++;
        userStats[clip.username].totalViews += clip.views_count || 0;
        userStats[clip.username].totalLikes += clip.likes_count || 0;
      });
    }

    // Get user points
    const usernames = Object.keys(userStats);
    const { data: usersData } = await supabase
      .from('users')
      .select('username, points')
      .in('username', usernames);

    // Merge points into stats
    if (usersData) {
      usersData.forEach(user => {
        if (userStats[user.username]) {
          userStats[user.username].points = user.points || 0;
        }
      });
    }

    // Note: Event participations could be added to quality score in the future
    // For now, we focus on clips, views, likes, and points

    // Calculate quality score for ALL profiles (no filtering - include everyone)
    const profilesWithClips = Object.values(userStats)
      .map(stat => {
        // Calculate quality score: clips (40%) + views (30%) + likes (20%) + points (10%)
        const qualityScore = 
          (stat.clipsCount * 10) +           // More clips = better
          (stat.totalViews / 100) +          // Views matter
          (stat.totalLikes * 5) +             // Likes matter more
          (stat.points || 0) / 10;            // Points bonus

        return {
          ...stat,
          qualityScore
        };
      })
      // Sort by quality score (best first)
      .sort((a, b) => b.qualityScore - a.qualityScore);

    // Also include users who have no clips but exist in the system (with very low priority)
    const { data: allUsers } = await supabase
      .from('users')
      .select('username, points')
      .not('username', 'is', null);

    // Add users without clips to the list (with zero quality score)
    const usersWithoutClips = (allUsers || [])
      .filter(user => !userStats[user.username])
      .map(user => ({
        username: user.username,
        clipsCount: 0,
        totalViews: 0,
        totalLikes: 0,
        points: user.points || 0,
        qualityScore: (user.points || 0) / 100 // Very low score for users without clips
      }));

    // Combine all profiles and sort by quality (best first)
    const allProfilesWithScore = [...profilesWithClips, ...usersWithoutClips]
      .sort((a, b) => b.qualityScore - a.qualityScore);

    console.log(`Including all ${allProfilesWithScore.length} profiles in sitemap (${profilesWithClips.length} with clips, ${usersWithoutClips.length} without clips), prioritized by quality score`);
    
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

    console.log(`Generated sitemap with ${processedClips?.length || 0} clips, ${allProfilesWithScore?.length || 0} user profiles (prioritized by quality), and ${events?.length || 0} events`);

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
           <video:player_loc allow_embed="yes">${clip.player_url}</video:player_loc>
           ${clip.video_url ? `<video:content_loc>${clip.video_url}</video:content_loc>` : ''}
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

     <!-- All User Profiles (Prioritized by Quality - Best Profiles First) -->
     ${allProfilesWithScore ? allProfilesWithScore.map((profile, index) => {
       // Calculate priority based on position (best profiles first)
       // This ensures Google shows the best profiles in sitelinks
       let priority = '0.3'; // Default low priority for empty profiles
       
       if (index < 10) {
         // Top 10 profiles: Highest priority (0.9-1.0) - these will show first
         priority = (1.0 - (index * 0.01)).toFixed(2);
       } else if (index < 30) {
         // Next 20 profiles: High priority (0.7-0.89)
         priority = (0.89 - ((index - 10) * 0.01)).toFixed(2);
       } else if (index < 60) {
         // Next 30 profiles: Medium priority (0.5-0.69)
         priority = (0.69 - ((index - 30) * 0.006)).toFixed(2);
       } else {
         // Rest: Low priority (0.3-0.49) - empty/low engagement profiles
         priority = (0.49 - ((index - 60) * 0.003)).toFixed(2);
       }
       
       // Ensure priority doesn't go below 0.1 or above 1.0
       priority = Math.max(0.1, Math.min(parseFloat(priority), 1.0)).toFixed(2);
       
       return `
       <url>
         <loc>${EXTERNAL_DATA_URL}/profile/${profile.username}</loc>
         <lastmod>${lastMod}</lastmod>
         <changefreq>daily</changefreq>
         <priority>${priority}</priority>
       </url>
     `;
     }).join('') : ''}
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