export const defaultSEO = {
  titleTemplate: '%s | Best Gaming Center in Tangier',
  defaultTitle: 'Premium Gaming Center Tangier | eSports & Gaming Café',
  description: 'Top-rated gaming center in Tangier, Morocco. Professional gaming setups, high-speed internet, competitive eSports events. Gaming café près de vous à Tanger. مقهى الألعاب في طنجة',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com',
    site_name: 'Your Gaming Center Name',
    images: [
      {
        url: '/images/gaming-center-banner.jpg', // Add your actual image path
        width: 1200,
        height: 630,
        alt: 'Best Gaming Center in Tangier',
      },
    ],
  },
  additionalLinkTags: [
    {
      rel: 'alternate',
      hrefLang: 'fr',
      href: `${process.env.NEXT_PUBLIC_SITE_URL}/fr`,
    },
    {
      rel: 'alternate',
      hrefLang: 'ar',
      href: `${process.env.NEXT_PUBLIC_SITE_URL}/ar`,
    },
  ],
  additionalMetaTags: [
    {
      name: 'keywords',
      content: 'gaming center tangier, cyber cafe tanger, gaming cafe morocco, esports tangier, internet cafe near me, gaming center near me, cyber gaming tanger, salle de jeux tanger, قاعة العاب طنجة, مقهى الانترنت في طنجة',
    },
    {
      name: 'geo.region',
      content: 'MA-01',
    },
    {
      name: 'geo.placename',
      content: 'Tangier',
    },
  ],
};

export const getLocalBusinessSchema = (businessInfo) => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: businessInfo.name,
  image: businessInfo.images,
  '@id': businessInfo.url,
  url: businessInfo.url,
  telephone: businessInfo.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: businessInfo.address,
    addressLocality: 'Tangier',
    addressRegion: 'Tanger-Tetouan-Al Hoceima',
    postalCode: businessInfo.postalCode,
    addressCountry: 'MA',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: businessInfo.latitude,
    longitude: businessInfo.longitude,
  },
  openingHoursSpecification: businessInfo.hours,
  priceRange: '$$',
  description: 'Premium Gaming Center in Tangier offering high-end gaming experiences, eSports events, and professional gaming setups.',
}); 