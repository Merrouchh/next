export const defaultSEO = {
  titleTemplate: '%s | Best Gaming Center in Tangier',
  defaultTitle: 'Premium Gaming Center Tangier | RTX 3070 Gaming PCs & eSports',
  description: 'Top-rated gaming center in Tangier with RTX 3070 PCs, 200Mbps internet, and competitive prices. Gaming café près de vous à Tanger. مقهى الألعاب في طنجة. Join our gaming community!',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://merrouchgaming.com',
    site_name: 'Merrouch Gaming',
    images: [
      {
        url: '/top.jpg',
        width: 1200,
        height: 630,
        alt: 'Best Gaming Center in Tangier - RTX 3070 Gaming PCs',
      },
    ],
  },
  additionalMetaTags: [
    {
      name: 'keywords',
      content: 'gaming center tangier, cyber cafe tanger, RTX 3070 gaming, gaming cafe morocco, esports tangier, internet cafe near me, gaming center near me, cyber gaming tanger, salle de jeux tanger, قاعة العاب طنجة, مقهى الانترنت في طنجة, gaming pc rental tangier, competitive gaming morocco',
    },
    {
      name: 'geo.region',
      content: 'MA-01',
    },
    {
      name: 'geo.placename',
      content: 'Tangier',
    },
    {
      name: 'google-site-verification',
      content: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    },
    {
      name: 'author',
      content: 'Merrouch Gaming Center'
    },
    {
      name: 'language',
      content: 'English, French, Arabic'
    },
    {
      name: 'robots',
      content: 'index, follow'
    }
  ],
  additionalLinkTags: [
    {
      rel: 'icon',
      href: '/favicon.ico',
    },
    {
      rel: 'apple-touch-icon',
      href: '/apple-touch-icon.png',
      sizes: '180x180'
    },
    {
      rel: 'canonical',
      href: 'https://merrouchgaming.com'
    }
  ],
  twitter: {
    handle: '@merrouchgaming',
    site: '@merrouchgaming',
    cardType: 'summary_large_image',
  }
};

export const getLocalBusinessSchema = (businessInfo) => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: businessInfo.name,
  image: businessInfo.images,
  '@id': businessInfo.url,
  url: businessInfo.url,
  telephone: businessInfo.phone,
  priceRange: businessInfo.priceRange,
  currenciesAccepted: businessInfo.currenciesAccepted,
  paymentAccepted: businessInfo.paymentAccepted,
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
  amenityFeature: businessInfo.amenityFeature,
  description: 'Premium Gaming Center in Tangier offering RTX 3070 gaming PCs, 200Mbps internet, competitive eSports events, and professional gaming setups. Best gaming experience in Morocco.',
});

export const businessInfo = {
  name: "Cyber Merrouch Gaming Center",
  images: [
    "https://merrouchgaming.com/top.jpg",
    "https://merrouchgaming.com/top2.jpg",
    "https://merrouchgaming.com/top3.jpg"
  ],
  url: "https://merrouchgaming.com",
  phone: "+212531098983",
  address: "RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1",
  postalCode: "90060",
  latitude: 35.768787,
  longitude: -5.8102713,
  priceRange: "$$",
  currenciesAccepted: "MAD",
  paymentAccepted: "Cash, Credit Card, PayPal",
  hours: [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Sunday"],
      "opens": "10:00",
      "closes": "23:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Friday", "Saturday"],
      "opens": "10:00",
      "closes": "00:00"
    }
  ],
  amenityFeature: [
    {
      "@type": "LocationFeatureSpecification",
      "name": "RTX 3070 Gaming PCs",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "200Mbps Internet",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "180Hz Gaming Monitors",
      "value": true
    }
  ]
}; 