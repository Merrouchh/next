import { createClient } from '../../utils/supabase/server-props';

export default async function handler(req, res) {
  try {
    const supabase = createClient();

    // Get all public clips
    const { data: clips } = await supabase
      .from('clips')
      .select('id')
      .eq('visibility', 'public');

    // Get all users with public clips
    const { data: users } = await supabase
      .from('users')
      .select('username');

    // Create XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <!-- Static Pages -->
      <url>
        <loc>https://merrouchgaming.com</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/discover</loc>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/shop</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>

      <!-- Dynamic Clip Pages -->
      ${clips?.map(clip => `
      <url>
        <loc>https://merrouchgaming.com/clip/${clip.id}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
      `).join('')}

      <!-- User Profile Pages -->
      ${users?.map(user => `
      <url>
        <loc>https://merrouchgaming.com/profile/${user.username}</loc>
        <changefreq>daily</changefreq>
        <priority>0.6</priority>
      </url>
      `).join('')}
    </urlset>`;

    // Set headers
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.write(sitemap);
    res.end();
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Error generating sitemap' });
  }
} 