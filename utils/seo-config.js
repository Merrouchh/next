/**
 * Business configuration for structured data and FAQ schema
 * Centralized business information used across the application
 */

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