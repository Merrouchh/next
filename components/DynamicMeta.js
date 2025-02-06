import { NextSeo } from 'next-seo';

export default function DynamicMeta({ 
  title, 
  description, 
  image = 'https://merrouchgaming.com/top.jpg',
  url,
  type = 'website'
}) {
  const currentTime = new Date().toISOString();

  return (
    <NextSeo
      title={title}
      description={description}
      canonical={url}
      openGraph={{
        title,
        description,
        url: url || 'https://merrouchgaming.com',
        type,
        site_name: 'Merrouch Gaming',
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
            type: 'image/jpeg',
          },
        ],
        updated_time: currentTime,
      }}
      twitter={{
        handle: '@merrouchgaming',
        site: '@merrouchgaming',
        cardType: 'summary_large_image',
      }}
      additionalMetaTags={[
        {
          name: 'twitter:image',
          content: image,
        },
        {
          name: 'twitter:title',
          content: title,
        },
        {
          name: 'twitter:description',
          content: description,
        },
        {
          property: 'og:updated_time',
          content: currentTime,
        },
        {
          name: 'robots',
          content: 'max-image-preview:large',
        }
      ]}
    />
  );
} 