import createClient from '../../utils/supabase/api'

const generateSitemap = async (clips, users) => {
  const lastMod = new Date().toISOString();
  const SUPABASE_URL = 'https://qdbtccrhcidxllycuxnw.supabase.co';
  
  const getClipThumbnailUrl = (thumbnailPath) => {
    if (!thumbnailPath) return null;
    try {
      return `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${thumbnailPath}`;
    } catch (error) {
      console.error('Error generating thumbnail URL:', error);
      return null;
    }
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
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
          (clip) => {
            const thumbnailUrl = getClipThumbnailUrl(clip.thumbnail_path);
            return `
              <url>
                <loc>https://merrouchgaming.com/clip/${clip.id}</loc>
                <lastmod>${new Date(clip.uploaded_at).toISOString()}</lastmod>
                <changefreq>monthly</changefreq>
                <priority>0.6</priority>
                ${thumbnailUrl ? `
                <image:image>
                  <image:loc>${thumbnailUrl}</image:loc>
                  <image:title>Gaming Clip ${clip.id}</image:title>
                </image:image>
                ` : ''}
              </url>
            `;
          }
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

    // Fetch public clips with thumbnail_path
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, uploaded_at, thumbnail_path')
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1000);

    if (clipsError) throw clipsError;

    // Fetch active users from users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('username')
      .not('username', 'is', null)
      .limit(1000);

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