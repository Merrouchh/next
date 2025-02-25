export default function PriceRangeSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "PriceSpecification",
          "name": "Gaming PC Prices",
          "description": "Gaming PC rental prices at Cyber Merrouch Gaming Center",
          "minPrice": "15",
          "maxPrice": "25",
          "priceCurrency": "MAD",
          "unitText": "per hour",
          "validFrom": "2024-01-01",
          "eligibleTransactionVolume": {
            "@type": "PriceSpecification",
            "price": "15",
            "priceCurrency": "MAD",
            "unitText": "per hour",
            "description": "Normal PC Gaming"
          }
        })
      }}
    />
  );
} 