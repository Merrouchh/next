import { NextSeo } from 'next-seo';

export default function DynamicMeta({ 
  title, 
  description, 
  image = 'https://merrouchgaming.com/top.jpg',
  url,
  type = 'website'
}) {
  return (
    <NextSeo
      title={title}
      description={description}
      openGraph={{
        title,
        description,
        url: url || 'https://merrouchgaming.com',
        type,
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      }}
      twitter={{
        cardType: 'summary_large_image',
        site: '@merrouchgaming',
      }}
    />
  );
} 