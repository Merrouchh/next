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
  structuredData = null,
  excludeFromAppSeo = false
}) {
  // Early return if no title or description provided
  if (!title && !description) {
    return null;
  }

  // Simple fallback component - only used for pages without server-side metadata
  // The main metadata is now handled in _document.js for social media crawlers
  
  // Create default OpenGraph object if none provided
  const defaultOpenGraph = {
    title,
    description,
    url,
    type,
    siteName: 'Merrouch Gaming',
    images: [
      {
        url: image,
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

  return (
    <>
      <Head>
        {/* Flag to indicate this component is active */}
        {excludeFromAppSeo && <meta name="x-dynamic-meta-active" content="true" />}
        
        {/* Basic client-side structured data */}
        {structuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
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