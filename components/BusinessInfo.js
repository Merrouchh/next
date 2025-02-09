import { getLocalBusinessSchema } from '../utils/seo-config';

const businessInfo = {
  name: 'Cyber Merrouch Gaming Center',
  images: [
    '/top.jpg',
    '/top2.jpg',
    '/top3.jpg'
  ],
  url: 'https://merrouchgaming.com',
  phone: '+212531098983',
  address: 'RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1',
  postalCode: '90060',
  latitude: '35.768787',
  longitude: '-5.8102713',
  hours: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday'],
      opens: '10:00',
      closes: '23:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Friday', 'Saturday'],
      opens: '10:00',
      closes: '00:00',
    }
  ],
  priceRange: '$$',
  amenityFeature: [
    {
      '@type': 'LocationFeatureSpecification',
      name: 'High-End Gaming PCs',
      value: true
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: '200Mbps Internet',
      value: true
    }
  ],
  hasMap: 'https://maps.app.goo.gl/mSxEf2vjqobp3xu59',
  placeId: 'ChIJPTRExBmBDA0RxbmuKa_APN0'
};

export default function BusinessInfo() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(getLocalBusinessSchema(businessInfo)),
      }}
    />
  );
} 