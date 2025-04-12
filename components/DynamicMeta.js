import { NextSeo } from 'next-seo';
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
  const currentTime = new Date().toISOString();
  
  // Don't add timestamp to image URLs that already have parameters
  const imageWithTimestamp = image.includes('?') ? image : `${image}?t=${currentTime}`;

  if (!title && !description) {
    return null;
  }

  // Create default OpenGraph object if none provided
  const defaultOpenGraph = {
    title,
    description,
    url,
    type,
    siteName: 'Merrouch Gaming',
    images: [
      {
        url: imageWithTimestamp,
        width: 1200,
        height: 630,
        alt: title || 'Merrouch Gaming',
        primary: true
      },
    ],
  };

  // Create default Twitter card if none provided
  const defaultTwitter = {
    handle: '@merrouchgaming',
    site: '@merrouchgaming',
    cardType: 'summary_large_image',
  };

  // Use provided objects or fallback to defaults
  const finalOpenGraph = openGraph || defaultOpenGraph;
  const finalTwitter = twitter || defaultTwitter;

  // Ensure we have properly sorted images in OpenGraph
  if (finalOpenGraph && finalOpenGraph.images && finalOpenGraph.images.length > 0) {
    // Sort images to ensure primary images come first
    finalOpenGraph.images.sort((a, b) => {
      // If one has primary: true and the other doesn't, the primary one comes first
      if (a.primary === true && b.primary !== true) return -1;
      if (a.primary !== true && b.primary === true) return 1;
      return 0; // Keep original order otherwise
    });
    
    // Ensure primary image has a timestamp for cache busting
    if (!finalOpenGraph.images[0].url.includes('?')) {
      finalOpenGraph.images[0].url = `${finalOpenGraph.images[0].url}?t=${currentTime}`;
    }
  }

  // Get the primary image URL for consistent use across all tags
  const primaryImageUrl = (finalOpenGraph && finalOpenGraph.images && finalOpenGraph.images.length > 0) 
    ? (finalOpenGraph.images.find(img => img.primary === true) || finalOpenGraph.images[0]).url
    : imageWithTimestamp;

  // Ensure Twitter image uses the primary image
  if (finalTwitter) {
    finalTwitter.image = primaryImageUrl;
  }

  // Determine which structured data to use
  const finalStructuredData = structuredDataItems || structuredData;

  return (
    <>
      <Head>
        {/* Set explicit itemprop image to ensure consistency */}
        <meta itemProp="image" content={primaryImageUrl} />
        
        {/* Force OG image with higher precedence */}
        <meta property="og:image" content={primaryImageUrl} />
        <meta property="og:image:secure_url" content={primaryImageUrl} />
        
        {/* Force Twitter image */}
        <meta name="twitter:image" content={primaryImageUrl} />

        {/* Add a flag for the app-level component to detect */}
        {excludeFromAppSeo && <meta name="x-dynamic-meta-active" content="true" />}
        
        {/* Explicitly remove any previous structured data scripts */}
        <script data-remove-previous-ld-json="true" type="text/plain" />
        
        {/* Add structured data if provided */}
        {finalStructuredData && (
          <>
            {Array.isArray(finalStructuredData) ? (
              // If it's an array of schema objects, render multiple script tags
              finalStructuredData.map((schema, index) => {
                const schemaContent = JSON.stringify(schema);
                const schemaHash = hashCode(schemaContent);
                return (
                  <script
                    key={`schema-${schemaHash}-${index}`}
                    type="application/ld+json"
                    data-schema-id={`structuredData-${schemaHash}`}
                    dangerouslySetInnerHTML={{ __html: schemaContent }}
                  />
                );
              })
            ) : (
              // If it's a single schema object, render one script tag
              (() => {
                const schemaContent = JSON.stringify(finalStructuredData);
                const schemaHash = hashCode(schemaContent);
                return (
                  <script
                    type="application/ld+json"
                    data-schema-id={`structuredData-${schemaHash}`}
                    dangerouslySetInnerHTML={{ __html: schemaContent }}
                  />
                );
              })()
            )}
          </>
        )}
      </Head>
      
      <NextSeo
        title={title}
        description={description}
        canonical={url}
        noindex={noindex}
        openGraph={finalOpenGraph}
        twitter={finalTwitter}
        additionalMetaTags={[
          {
            name: 'keywords',
            content: `gaming center tangier, ${(title || '').toLowerCase()}, gaming morocco`
          }
        ]}
      />
    </>
  );
} 