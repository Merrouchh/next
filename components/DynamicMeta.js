import { NextSeo } from 'next-seo';

export default function DynamicMeta({ 
  title, 
  description, 
  image = 'https://merrouchgaming.com/top.jpg',
  url,
  type = 'website'
}) {
  const currentTime = new Date().toISOString();
  const imageWithTimestamp = `${image}?t=${currentTime}`;

  return (
    <NextSeo
      title={title}
      description={description}
      canonical={url}
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
            alt: title,
          },
        ],
      }}
      twitter={{
        handle: '@merrouchgaming',
        site: '@merrouchgaming',
        cardType: 'summary_large_image',
      }}
    />
  );
} 