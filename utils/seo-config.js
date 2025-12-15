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
  ],
  // PC Gaming Specific Configuration for SEO
  pcGaming: {
    // Full PC Specifications for SEO
    specifications: {
      cpu: "AMD Ryzen 7 7700",
      gpu: "NVIDIA GeForce RTX 3070 (8GB VRAM)",
      ram: "16GB DDR5 RAM",
      storage: "NVMe SSD",
      monitors: "180Hz Gaming Monitors",
      resolution: "1080p Ultra / 1440p High settings",
      keyboard: "Mechanical Gaming Keyboards",
      mouse: "High-DPI Gaming Mice",
      audio: "Gaming Headsets Available"
    },
    // Popular PC Games (for SEO targeting)
    popularGames: [
      "VALORANT", "CS2", "League of Legends", "Fortnite", 
      "Call of Duty", "Apex Legends", "Rocket League", 
      "FIFA", "PUBG", "GTA V", "Minecraft", "Among Us"
    ],
    // PC Gaming Services
    services: [
      "Steam Account Support",
      "Epic Games Launcher",
      "Battle.net Support",
      "Discord Voice Chat",
      "PC Gaming Tournaments",
      "PC Gaming Leaderboards",
      "High FPS Competitive Gaming",
      "PC Gaming Community"
    ],
    // Performance Capabilities
    performance: {
      maxFPS: "180+ FPS at 1080p",
      rayTracing: "Supported",
      dlss: "DLSS 2.0 Supported",
      vrReady: false,
      streaming: "Game Recording & Streaming Available"
    },
    // SEO Keywords for PC Gaming
    keywords: [
      "PC gaming center Tangier",
      "RTX 3070 gaming PC rental",
      "high-end gaming PC Tangier",
      "competitive PC gaming Morocco",
      "Ryzen 7 gaming PC",
      "180Hz gaming monitor Tangier",
      "PC gaming cafe Tangier",
      "esports PC gaming center",
      "professional gaming PC rental",
      "gaming PC with RTX 3070 Tangier"
    ]
  }
}; 