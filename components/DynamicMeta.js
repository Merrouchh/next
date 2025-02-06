import { NextSeo } from 'next-seo';
import Head from 'next/head';

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
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} key="og-title" />
        <meta property="og:description" content={description} key="og-desc" />
        <meta property="og:image" content={imageWithTimestamp} key="og-image" />
        <meta property="og:url" content={url} key="og-url" />
        <meta property="og:type" content={type} key="og-type" />
        <meta name="twitter:card" content="summary_large_image" key="tw-card" />
        <meta name="twitter:title" content={title} key="tw-title" />
        <meta name="twitter:description" content={description} key="tw-desc" />
        <meta name="twitter:image" content={imageWithTimestamp} key="tw-image" />
      </Head>
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
    </>
  );
} 