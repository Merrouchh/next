import createClient from '../../utils/supabase/api'

const generateSitemap = async (clips, users) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
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
        <loc>https://merrouchgaming.com/avcomputers</loc>
        <changefreq>hourly</changefreq>
        <priority>0.8</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/shop</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/topusers</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
      </url>

      <!-- Dynamic Clip Pages -->
      ${clips
        .map(
          (clip) => `
        <url>
          <loc>https://merrouchgaming.com/clip/${clip.id}</loc>
          <lastmod>${new Date(clip.uploaded_at).toISOString()}</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.6</priority>
        </url>
      `
        )
        .join('')}

      <!-- User Profile Pages -->
      ${users
        .map(
          (user) => `
        <url>
          <loc>https://merrouchgaming.com/profile/${user.username}</loc>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
        </url>
      `
        )
        .join('')}
    </urlset>`;
};

export default async function handler(req, res) {
  try {
    const supabase = createClient(req, res);  // Create API client with req/res

    // Fetch public clips
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, uploaded_at')
      .eq('visibility', 'public');

    if (clipsError) {
      console.error('Error fetching clips:', clipsError);
      throw clipsError;
    }

    // Fetch users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('username');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Generate the sitemap XML
    const sitemap = await generateSitemap(clips || [], users || []);

    // Set the appropriate headers
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=1200, stale-while-revalidate=600');

    // Send the XML to the browser
    res.write(sitemap);
    res.end();
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ 
      error: 'Error generating sitemap',
      details: error.message 
    });
  }
} 