import { NextSeo } from 'next-seo';
import Head from 'next/head';
import { useEffect, useState } from 'react';

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
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
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
        {/* Override default title and description with key to ensure replacement */}
        <title key="title">{title}</title>
        <meta key="description" name="description" content={description} />
        
        {/* Override OpenGraph tags with keys */}
        <meta key="og:title" property="og:title" content={finalOpenGraph.title} />
        <meta key="og:description" property="og:description" content={finalOpenGraph.description} />
        <meta key="og:type" property="og:type" content={finalOpenGraph.type} />
        <meta key="og:url" property="og:url" content={finalOpenGraph.url || url} />
        <meta key="og:site_name" property="og:site_name" content="Merrouch Gaming" />
        
        {/* Set explicit itemprop image to ensure consistency */}
        <meta itemProp="image" content={primaryImageUrl} />
        
        {/* Force OG image with higher precedence */}
        <meta key="og:image" property="og:image" content={primaryImageUrl} />
        <meta key="og:image:secure_url" property="og:image:secure_url" content={primaryImageUrl} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta key="og:image:alt" property="og:image:alt" content={`${title} - Gaming Tournament`} />
        
        {/* Force Twitter tags with keys */}
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:site" name="twitter:site" content="@merrouchgaming" />
        <meta key="twitter:title" name="twitter:title" content={finalTwitter.title || title} />
        <meta key="twitter:description" name="twitter:description" content={finalTwitter.description || description} />
        <meta key="twitter:image" name="twitter:image" content={primaryImageUrl} />
        
        {/* Canonical URL */}
        <link key="canonical" rel="canonical" href={url} />

        {/* Keywords meta tag */}
        <meta key="keywords" name="keywords" content={`gaming center tangier, ${(title || '').toLowerCase()}, gaming morocco`} />
        
        {/* Robots meta tag */}
        {noindex && <meta key="robots" name="robots" content="noindex,nofollow" />}
        
        {/* Add a flag for the app-level component to detect */}
        {excludeFromAppSeo && <meta name="x-dynamic-meta-active" content="true" />}
        
        {/* Add structured data as regular HTML script tags - only if mounted */}
        {mounted && finalStructuredData && (
          <>
            {Array.isArray(finalStructuredData) ? (
              // If it's an array of schema objects, render multiple script tags
              finalStructuredData.map((schema, index) => {
                try {
                  const schemaContent = JSON.stringify(schema);
                  const schemaHash = hashCode(schemaContent);
                  return (
                    <script
                      key={`schema-${schemaHash}-${index}`}
                      id={`schema-${schemaHash}-${index}`}
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
              // If it's a single schema object, render one script tag
              (() => {
                try {
                  const schemaContent = JSON.stringify(finalStructuredData);
                  const schemaHash = hashCode(schemaContent);
                  return (
                    <script
                      key={`schema-${schemaHash}`}
                      id={`schema-${schemaHash}`}
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
      </Head>
    </>
  );
} 