import { NextSeo } from 'next-seo';

export default function DynamicMeta({ 
  title = '',
  description = '',
  image = 'https://merrouchgaming.com/top.jpg',
  url = '',
  type = 'website',
  noindex = false
}) {
  const currentTime = new Date().toISOString();
  const imageWithTimestamp = `${image}?t=${currentTime}`;

  if (!title && !description) {
    return null;
  }

  return (
    <NextSeo
      title={title}
      description={description}
      canonical={url}
      noindex={noindex}
      openGraph={{
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
      }}
      twitter={{
        handle: '@merrouchgaming',
        site: '@merrouchgaming',
        cardType: 'summary_large_image',
      }}
      additionalMetaTags={[
        {
          name: 'keywords',
          content: `gaming center tangier, ${(title || '').toLowerCase()}, gaming morocco`
        }
      ]}
    />
  );
} 