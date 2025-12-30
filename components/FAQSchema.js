import { businessInfo } from '../utils/seo-config';

export const faqData = [
  {
    "@type": "Question",
    "name": "What are your opening hours?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `We are open every day from ${businessInfo.hours[0].opens}. Sunday to Thursday we close at ${businessInfo.hours[0].closes}, while Friday and Saturday we close at ${businessInfo.hours[1].closes}.`
    }
  },
  {
    "@type": "Question",
    "name": "What PC gaming equipment do you have?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `We offer high-end gaming PCs equipped with ${businessInfo.pcGaming?.specifications?.cpu || 'AMD Ryzen 7 7700'} processors, ${businessInfo.pcGaming?.specifications?.gpu || 'NVIDIA GeForce RTX 3070 (8GB VRAM)'} graphics cards, ${businessInfo.pcGaming?.specifications?.ram || '16GB DDR5 RAM'}, NVMe SSD storage, and ${businessInfo.pcGaming?.specifications?.monitors || '240Hz gaming monitors'}. All PCs include mechanical gaming keyboards and high-DPI gaming mice for the best PC gaming experience.`
    }
  },
  {
    "@type": "Question",
    "name": "Do you only have PC gaming or also consoles?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "We are a PC-only gaming center. We specialize exclusively in PC gaming with high-performance gaming PCs. All 14 gaming stations are equipped with premium PC gaming hardware optimized for competitive PC gaming and esports."
    }
  },
  {
    "@type": "Question",
    "name": "What PC games can I play?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `You can play all popular PC games including ${businessInfo.pcGaming?.popularGames?.slice(0, 5).join(', ') || 'VALORANT, CS2, League of Legends, Fortnite, Call of Duty'} and many more. We support Steam, Epic Games Launcher, Battle.net, and other PC gaming platforms. You can use your own gaming accounts or we can help you set up new accounts.`
    }
  },
  {
    "@type": "Question",
    "name": "What is your internet speed for PC gaming?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "We provide 200Mbps high-speed internet connection with ultra-low ping optimized for competitive PC gaming. Our network is specifically configured for online PC gaming with minimal latency for the best gaming performance."
    }
  },
  {
    "@type": "Question",
    "name": "What FPS can your gaming PCs achieve?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `Our RTX 3070 gaming PCs can achieve ${businessInfo.pcGaming?.performance?.maxFPS || '240+ FPS'} at 1080p resolution on high settings in most popular PC games. With our 240Hz gaming monitors, you'll experience smooth, competitive gaming with full refresh rate support. Ray tracing and DLSS 2.0 are also supported for compatible games.`
    }
  },
  {
    "@type": "Question",
    "name": "Where are you located in Tangier?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `We are located at ${businessInfo.address}, ${businessInfo.postalCode}. You can find us easily using Google Maps or contact us at ${businessInfo.phone}.`
    }
  },
  {
    "@type": "Question",
    "name": "Can I use my Steam account on your gaming PCs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes! You can use your own Steam, Epic Games, Battle.net, or any other PC gaming platform account. All gaming PCs have the major gaming launchers installed and ready to use. Just log in with your account and access your game library."
    }
  },
  {
    "@type": "Question",
    "name": "Do you host PC gaming tournaments?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, we regularly host PC gaming tournaments and competitive events. Check our Events page for upcoming tournaments in games like VALORANT, CS2, League of Legends, and more. We also maintain leaderboards for the top PC gamers in our community."
    }
  }
];

// Create a FAQPage schema object that can be used in structured data
export const getFAQPageSchema = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqData
});

// Removing the default component export that renders a script tag
// Now this file only exports data that can be used by other components 