import { NextSeo } from 'next-seo';
import Head from 'next/head';

export default function DynamicMeta({ 
  title = '',
  description = '',
  image = 'https://merrouchgaming.com/top.jpg',
  url = '',
  type = 'website',
  noindex = false,
  openGraph = null,
  twitter = null,
  structuredData = null
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

  // Ensure we have an image with timestamp in OpenGraph if not overridden
  if (finalOpenGraph && finalOpenGraph.images && finalOpenGraph.images.length > 0) {
    // Only add timestamp if the image URL doesn't already have parameters
    if (!finalOpenGraph.images[0].url.includes('?')) {
      finalOpenGraph.images[0].url = `${finalOpenGraph.images[0].url}?t=${currentTime}`;
    }
  }

  // Ensure we have an image with timestamp in Twitter if not overridden
  if (finalTwitter && finalTwitter.image && !finalTwitter.image.includes('?')) {
    finalTwitter.image = `${finalTwitter.image}?t=${currentTime}`;
  }

  return (
    <>
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
      
      {/* Add structured data if provided */}
      {structuredData && (
        <Head>
          {Array.isArray(structuredData) ? (
            // If it's an array of schema objects, render multiple script tags
            structuredData.map((schema, index) => (
              <script
                key={`schema-${index}`}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
              />
            ))
          ) : (
            // If it's a single schema object, render one script tag
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
          )}
        </Head>
      )}
    </>
  );
} 