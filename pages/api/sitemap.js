import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Create Supabase client with environment variables
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin access
    );

    // Get all public clips
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id')
      .eq('visibility', 'public');

    if (clipsError) throw clipsError;

    // Get all users with public clips
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('username');

    if (usersError) throw usersError;

    // Get current date for lastmod
    const currentDate = new Date().toISOString();

    // Create XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <!-- Static Pages -->
      <url>
        <loc>https://merrouchgaming.com</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/discover</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/shop</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>

      <!-- Dynamic Clip Pages -->
      ${clips?.map(clip => `
        <url>
          <loc>https://merrouchgaming.com/clip/${clip.id}</loc>
          <lastmod>${currentDate}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `).join('')}

      <!-- User Profile Pages -->
      ${users?.map(user => `
        <url>
          <loc>https://merrouchgaming.com/profile/${user.username}</loc>
          <lastmod>${currentDate}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.6</priority>
        </url>
      `).join('')}
    </urlset>`;

    // Set headers
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    
    // Remove any extra whitespace and empty lines
    const cleanSitemap = sitemap
      .trim()
      .replace(/^\s+/gm, '')  // Remove leading whitespace
      .replace(/\n+/g, '\n'); // Remove extra newlines

    res.write(cleanSitemap);
    res.end();

  } catch (error) {
    console.error('Error generating sitemap:', error);
    
    // Send a more detailed error response
    res.status(500).json({ 
      error: 'Error generating sitemap',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 