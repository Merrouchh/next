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
  // Don't render if no title and description
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
        url: image,
        width: 1200,
        height: 630,
        alt: title || 'Merrouch Gaming'
      }
    ]
  };

  // Create default Twitter card if none provided
  const defaultTwitter = {
    handle: '@merrouchgaming',
    site: '@merrouchgaming',
    cardType: 'summary_large_image'
  };

  // Use provided objects or fallback to defaults
  const finalOpenGraph = openGraph || defaultOpenGraph;
  const finalTwitter = twitter || defaultTwitter;

  return (
    <>
      <Head>
        {/* Basic meta tags */}
        <title>{title}</title>
        <meta name="description" content={description} />
        
        {/* OpenGraph tags */}
        <meta property="og:title" content={finalOpenGraph.title} />
        <meta property="og:description" content={finalOpenGraph.description} />
        <meta property="og:image" content={finalOpenGraph.images[0].url} />
        <meta property="og:url" content={finalOpenGraph.url} />
        <meta property="og:type" content={finalOpenGraph.type} />
        <meta property="og:site_name" content={finalOpenGraph.siteName} />
        
        {/* Twitter tags */}
        <meta name="twitter:card" content={finalTwitter.cardType} />
        <meta name="twitter:site" content={finalTwitter.site} />
        <meta name="twitter:title" content={finalOpenGraph.title} />
        <meta name="twitter:description" content={finalOpenGraph.description} />
        <meta name="twitter:image" content={finalOpenGraph.images[0].url} />
        
        {/* Canonical URL */}
        {url && <link rel="canonical" href={url} />}
        
        {/* Structured data */}
        {structuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData)
            }}
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