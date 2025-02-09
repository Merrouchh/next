export default function FAQSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What are your opening hours?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "We are open every day from 10:00 AM. Sunday to Thursday we close at 11:00 PM, while Friday and Saturday we close at midnight."
              }
            },
            {
              "@type": "Question",
              "name": "What gaming equipment do you have?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "We offer high-end gaming PCs equipped with Ryzen 7 7700 processors, RTX 3070 graphics cards, and 180Hz professional displays."
              }
            },
            {
              "@type": "Question",
              "name": "What is your internet speed?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "We provide 200Mbps high-speed internet connection with ultra-low ping for optimal gaming experience."
              }
            },
            {
              "@type": "Question",
              "name": "Where are you located in Tangier?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "We are located at RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1, Tangier 90060. You can find us easily using Google Maps or our plus code: Q59Q+FW Tanger."
              }
            }
          ]
        })
      }}
    />
  );
} 