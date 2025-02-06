export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/ld+json');
  res.json({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://merrouchgaming.com",
    "name": "Cyber Merrouch Gaming Center",
    "image": [
      "https://merrouchgaming.com/top.jpg",
      "https://merrouchgaming.com/top2.jpg",
      "https://merrouchgaming.com/top3.jpg"
    ],
    "url": "https://merrouchgaming.com",
    "telephone": "+212531098983",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1",
      "addressLocality": "Tangier",
      "postalCode": "90060",
      "addressCountry": "MA"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 35.768787,
      "longitude": -5.8102713
    },
    "openingHoursSpecification": [
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
    "sameAs": [
      "https://instagram.com/merrouchgaming",
      "https://maps.app.goo.gl/mSxEf2vjqobp3xu59"
    ],
    "hasMap": "https://maps.app.goo.gl/mSxEf2vjqobp3xu59",
    "plus_code": "Q59Q+FW Tanger",
    "place_id": "ChIJPTRExBmBDA0RxbmuKa_APN0"
  });
} 