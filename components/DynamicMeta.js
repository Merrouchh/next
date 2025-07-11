import Head from 'next/head';

// Simple hash function to identify content
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export default function DynamicMeta({ 
  title = '',
  description = '',
  image = 'https://merrouchgaming.com/top.jpg',
  url = '',
  type = 'website',
  noindex = false,
  openGraph = null,
  twitter = null,
  structuredData = null,
  structuredDataItems = null,
  excludeFromAppSeo = false
}) {
  
  // Only return null if both title and description are completely empty
  if ((!title || title.trim() === '') && (!description || description.trim() === '')) {
    return null;
  }
  
  // Ensure we have fallback values
  const finalTitle = title || 'Merrouch Gaming';
  const finalDescription = description || 'Premium gaming center in Tangier with RTX 3070 PCs';
  const finalImage = image || 'https://merrouchgaming.com/top.jpg';
  const finalUrl = url || 'https://merrouchgaming.com';
  
  // For server-side rendering, don't add timestamps to images for social media crawlers
  const imageForMeta = finalImage;

  // Use provided OpenGraph or create default
  const ogTitle = openGraph?.title || finalTitle;
  const ogDescription = openGraph?.description || finalDescription;
  const ogImage = openGraph?.images?.[0]?.url || imageForMeta;
  
  // Use provided Twitter data or create default
  const twitterTitle = twitter?.title || finalTitle;
  const twitterDescription = twitter?.description || finalDescription;
  const twitterImage = twitter?.image || imageForMeta;

  // Determine which structured data to use
  const finalStructuredData = structuredDataItems || structuredData;

  return (
    <Head>
      {/* Basic meta tags */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={`gaming center tangier, ${finalTitle.toLowerCase()}, gaming morocco`} />
      {noindex && <meta name="robots" content="noindex" />}
      
      {/* OpenGraph meta tags */}
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogTitle} />
      <meta property="og:url" content={finalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Merrouch Gaming" />
      
      {/* Twitter Card meta tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@merrouchgaming" />
      <meta name="twitter:creator" content="@merrouchgaming" />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={twitterDescription} />
      <meta name="twitter:image" content={twitterImage} />
      <meta name="twitter:image:alt" content={twitterTitle} />
      
      {/* Schema.org structured data */}
      {finalStructuredData && (
        <>
          {Array.isArray(finalStructuredData) ? (
            finalStructuredData.map((schema, index) => {
              try {
                const schemaContent = JSON.stringify(schema);
                const schemaHash = hashCode(schemaContent);
                return (
                  <script
                    key={`schema-${schemaHash}-${index}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: schemaContent }}
                  />
                );
              } catch (error) {
                console.error('Error rendering schema:', error);
                return null;
              }
            })
          ) : (
            (() => {
              try {
                const schemaContent = JSON.stringify(finalStructuredData);
                const schemaHash = hashCode(schemaContent);
                return (
                  <script
                    key={`schema-${schemaHash}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: schemaContent }}
                  />
                );
              } catch (error) {
                console.error('Error rendering schema:', error);
                return null;
              }
            })()
          )}
        </>
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={finalUrl} />
    </Head>
  );
} 