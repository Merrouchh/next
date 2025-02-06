const EXTERNAL_DATA_URL = 'https://merrouchgaming.com';

function generateSiteMap() {
  const lastMod = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
           xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
     <url>
       <loc>${EXTERNAL_DATA_URL}</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>daily</changefreq>
       <priority>1.0</priority>
       <image:image>
         <image:loc>${EXTERNAL_DATA_URL}/top.jpg</image:loc>
         <image:title>Cyber Merrouch Gaming Center</image:title>
       </image:image>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/discover</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>hourly</changefreq>
       <priority>0.9</priority>
       <image:image>
         <image:loc>${EXTERNAL_DATA_URL}/top2.jpg</image:loc>
         <image:title>Gaming Highlights</image:title>
       </image:image>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/avcomputers</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>hourly</changefreq>
       <priority>0.8</priority>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/shop</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>weekly</changefreq>
       <priority>0.7</priority>
       <image:image>
         <image:loc>${EXTERNAL_DATA_URL}/top3.jpg</image:loc>
         <image:title>Gaming Prices</image:title>
       </image:image>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/topusers</loc>
       <lastmod>${lastMod}</lastmod>
       <changefreq>daily</changefreq>
       <priority>0.8</priority>
     </url>
   </urlset>
 `;
}

function SiteMap() {
  // getServerSideProps will do the heavy lifting
}

export async function getServerSideProps({ res }) {
  const sitemap = generateSiteMap();

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=1200, stale-while-revalidate=600');
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
}

export default SiteMap; 