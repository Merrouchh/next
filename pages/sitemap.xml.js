const EXTERNAL_DATA_URL = 'https://merrouchgaming.com';
import { createClient } from '@supabase/supabase-js';

async function generateSiteMap() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const lastMod = new Date().toISOString();

  // Fetch only public clips with better ordering
  const { data: clips } = await supabase
    .from('clips')
    .select('id, uploaded_at, title')
    .eq('visibility', 'public')
    .order('uploaded_at', { ascending: false })
    .limit(1000);

  // Fetch only users who have public clips
  const { data: users } = await supabase
    .from('clips')
    .select('username')
    .eq('visibility', 'public')
    .order('uploaded_at', { ascending: false });

  // Get unique usernames
  const uniqueUsers = [...new Set(users?.map(user => user.username))];

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
       <loc>${EXTERNAL_DATA_URL}/topusers</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>hourly</changefreq>
       <priority>0.7</priority>
     </url>

     <!-- Public Clips -->
     ${clips ? clips.map(clip => `
       <url>
         <loc>${EXTERNAL_DATA_URL}/clip/${clip.id}</loc>
         <lastmod>${new Date(clip.uploaded_at).toISOString()}</lastmod>
         <changefreq>weekly</changefreq>
         <priority>0.7</priority>
         <video:video>
           <video:title>${clip.title}</video:title>
           <video:description>Gaming clip shared on Merrouch Gaming</video:description>
           <video:player_loc>${EXTERNAL_DATA_URL}/clip/${clip.id}</video:player_loc>
           <video:thumbnail_loc>${EXTERNAL_DATA_URL}/top.jpg</video:thumbnail_loc>
         </video:video>
       </url>
     `).join('') : ''}

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
}

export async function getServerSideProps({ res }) {
  try {
    const sitemap = await generateSiteMap();
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.write(sitemap);
    res.end();
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