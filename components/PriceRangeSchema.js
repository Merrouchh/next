// Export the Price Range schema data that can be used in structured data
export const getPriceRangeSchema = () => ({
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
});

// Remove the default component export that renders a script tag
// Now this file only exports data that can be used by other components 