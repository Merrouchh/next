import createClient from '../../utils/supabase/api'

const generateSitemap = async (clips, users) => {
  const lastMod = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:xhtml="http://www.w3.org/1999/xhtml"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <!-- Static Pages -->
      <url>
        <loc>https://merrouchgaming.com</loc>
        <lastmod>${lastMod}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <image:image>
          <image:loc>https://merrouchgaming.com/top.jpg</image:loc>
          <image:title>Cyber Merrouch Gaming Center</image:title>
        </image:image>
      </url>
      <url>
        <loc>https://merrouchgaming.com/discover</loc>
        <lastmod>${lastMod}</lastmod>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/avcomputers</loc>
        <lastmod>${lastMod}</lastmod>
        <changefreq>hourly</changefreq>
        <priority>0.8</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/shop</loc>
        <lastmod>${lastMod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
      <url>
        <loc>https://merrouchgaming.com/topusers</loc>
        <lastmod>${lastMod}</lastmod>
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
          ${clip.thumbnail ? `
          <image:image>
            <image:loc>${clip.thumbnail}</image:loc>
            <image:title>Gaming Clip ${clip.id}</image:title>
          </image:image>
          ` : ''}
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
          <lastmod>${lastMod}</lastmod>
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
    const supabase = createClient(req, res);

    // Fetch public clips with thumbnails
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, uploaded_at, thumbnail')
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1000); // Limit to recent 1000 clips for sitemap size

    if (clipsError) throw clipsError;

    // Fetch active users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('username')
      .not('username', 'is', null)
      .limit(1000); // Limit to 1000 most active users

    if (usersError) throw usersError;

    const sitemap = await generateSitemap(clips || [], users || []);

    // Set headers
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=1200, stale-while-revalidate=600');

    // Send the XML
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