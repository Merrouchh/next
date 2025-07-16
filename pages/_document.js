import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => App,
          enhanceComponent: (Component) => Component,
        });

      const initialProps = await Document.getInitialProps(ctx);
      
      // Universal metadata injection system for social media crawlers
      const metadata = await generateDynamicMetadata(ctx);
      if (metadata) {
        initialProps.dynamicMetadata = metadata;
      }
      
      return { ...initialProps };
    } catch (error) {
      console.error('Error in _document.js getInitialProps:', error);
      return { ...await Document.getInitialProps(ctx) };
    }
  }

  render() {
    const { dynamicMetadata } = this.props;
    
    // Default metadata for pages without dynamic metadata
    const defaultMetadata = {
      title: "Premium Gaming Center Tangier | RTX 3070 Gaming PCs & eSports",
      description: "Top-rated gaming center in Tangier with RTX 3070 PCs, 200Mbps internet, and competitive prices. Gaming café près de vous à Tanger. مقهى الألعاب في طنجة. Join our gaming community!",
      image: "https://merrouchgaming.com/top.jpg",
      url: "https://merrouchgaming.com",
      type: "website",
      keywords: "gaming center tangier, cyber cafe tanger, RTX 3070 gaming, gaming cafe morocco, esports tangier, internet cafe near me, gaming center near me, cyber gaming tanger, salle de jeux tanger, قاعة العاب طنجة, مقهى الانترنت في طنجة, gaming pc rental tangier, competitive gaming morocco",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "Cyber Merrouch Gaming Center",
        "description": "Premium Gaming Center in Tangier offering RTX 3070 gaming PCs, 200Mbps internet, competitive eSports events, and professional gaming setups. Best gaming experience in Morocco.",
        "image": "https://merrouchgaming.com/top.jpg",
        "url": "https://merrouchgaming.com",
        "telephone": "+212531098983",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1",
          "addressLocality": "Tangier",
          "addressRegion": "Tanger-Tetouan-Al Hoceima",
          "postalCode": "90060",
          "addressCountry": "MA"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 35.768787,
          "longitude": -5.8102713
        },
        "priceRange": "$$",
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
        ]
      }
    };

    // Use dynamic metadata if available, otherwise use default
    const metadata = dynamicMetadata || defaultMetadata;
    
    return (
      <Html lang="en">
        <Head>
          {/* UNIVERSAL METADATA INJECTION - WORKS FOR ALL SOCIAL MEDIA CRAWLERS */}
          {/* Note: <title> is handled by Next.js Head component in pages, not _document.js */}
          <meta name="description" content={metadata.description} />
          
          {/* Open Graph tags */}
          <meta property="og:title" content={metadata.title} />
          <meta property="og:description" content={metadata.description} />
          <meta property="og:image" content={metadata.image} />
          <meta property="og:url" content={metadata.url} />
          <meta property="og:type" content={metadata.type} />
          <meta property="og:site_name" content="Merrouch Gaming" />
          
          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@merrouchgaming" />
          <meta name="twitter:title" content={metadata.title} />
          <meta name="twitter:description" content={metadata.description} />
          <meta name="twitter:image" content={metadata.image} />
          
          {/* Additional metadata */}
          <meta name="keywords" content={metadata.keywords} />
          <meta name="robots" content="index, follow" />
          <meta name="author" content="Merrouch Gaming" />
          <meta name="geo.region" content="MA-01" />
          <meta name="geo.placename" content="Tangier" />
          <meta name="language" content="English, French, Arabic" />
          <link rel="canonical" href={metadata.url} />
          
          {/* Structured Data */}
          {metadata.structuredData && (
            <script 
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(metadata.structuredData)
              }}
            />
          )}
          
          {/* Essential meta tags and resources */}
          <link 
            rel="preconnect" 
            href="https://fonts.googleapis.com" 
            crossOrigin="anonymous"
          />
          <link 
            rel="preconnect" 
            href="https://fonts.gstatic.com" 
            crossOrigin="anonymous"
          />
          
          {/* Preload critical resources */}
          <link 
            rel="preload" 
            href="/logomobile.png" 
            as="image"
            type="image/png"
          />
          <link 
            rel="preload" 
            href="/top.jpg" 
            as="image"
            type="image/jpeg"
          />
          <link 
            rel="preload" 
            href="/favicon.ico" 
            as="image"
            type="image/x-icon"
          />
          
          {/* Map tile servers preconnect - saves ~300ms LCP */}
          <link 
            rel="preconnect" 
            href="https://a.basemaps.cartocdn.com" 
            crossOrigin="anonymous"
          />
          <link 
            rel="preconnect" 
            href="https://b.basemaps.cartocdn.com" 
            crossOrigin="anonymous"
          />
          <link 
            rel="preconnect" 
            href="https://c.basemaps.cartocdn.com" 
            crossOrigin="anonymous"
          />
          
          {/* CDN preconnect for video scripts (loaded conditionally) */}
          <link 
            rel="preconnect" 
            href="https://cdn.jsdelivr.net" 
            crossOrigin="anonymous"
          />
          
          {/* PWA */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="application-name" content="Merrouch" />
          <meta name="apple-mobile-web-app-title" content="Merrouch" />
          <meta name="theme-color" content="#FFD700" />
          <meta name="msapplication-TileColor" content="#FFD700" />
          <meta name="msapplication-navbutton-color" content="#FFD700" />
          
          {/* Cloudflare optimization - defer beacon loading */}
          <meta name="cf-beacon" content="defer" />
          
          {/* Removed Media Chrome and HLS scripts to prevent critical request chain on homepage */}
          {/* These will be loaded conditionally only where video players are needed */}
        </Head>
        <body>
          <Main />
          <NextScript />
          
          {/* Development error handling */}
          {process.env.NODE_ENV === 'development' && (
            <script 
              dangerouslySetInnerHTML={{ 
                __html: `
                  window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
                  window.__NEXT_DATA__.nextExport = true;
                  
                  const originalError = console.error;
                  console.error = (...args) => {
                    if (
                      args[0] && 
                      typeof args[0] === 'string' && 
                      (args[0].includes('AuthApiError') || 
                       args[0].includes('Invalid login credentials') ||
                       args[0].includes('Current password is incorrect') ||
                       args[0].includes('verification code') ||
                       args[0].includes('Invalid verification code'))
                    ) {
                      return;
                    }
                    return originalError.apply(console, args);
                  };
                  
                  window.addEventListener('error', function(event) {
                    if (
                      event.error && 
                      (event.error.name === 'AuthApiError' || 
                       (event.error.message && (
                         event.error.message.includes('Invalid login credentials') ||
                         event.error.message.includes('Current password is incorrect') ||
                         event.error.message.includes('verification code') ||
                         event.error.message.includes('Invalid verification code'))))
                    ) {
                      event.preventDefault();
                      return false;
                    }
                  }, true);
                  
                  window.addEventListener('unhandledrejection', function(event) {
                    if (
                      event.reason && 
                      (event.reason.name === 'AuthApiError' || 
                       (event.reason.message && (
                         event.reason.message.includes('Invalid login credentials') ||
                         event.reason.message.includes('Current password is incorrect') ||
                         event.reason.message.includes('verification code') ||
                         event.reason.message.includes('Invalid verification code'))))
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      console.debug("Suppressed error:", event.reason.message);
                      return false;
                    }
                  }, true);
                  
                  const origCatchErrors = window.__NEXT_PROMISE_REJECTION_HANDLER__;
                  window.__NEXT_PROMISE_REJECTION_HANDLER__ = function(err) {
                    if (
                      err && 
                      typeof err.message === 'string' && 
                      (err.message.includes('verification code') || 
                       err.message.includes('Invalid verification code'))
                    ) {
                      console.debug("Next.js rejection handler suppressed error:", err.message);
                      return false;
                    }
                    return origCatchErrors ? origCatchErrors(err) : false;
                  };
                `
              }} 
            />
          )}
          
          <script dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined') {
                    const hash = window.location.hash;
                    if (hash && 
                        hash.includes('access_token=') && 
                        hash.includes('refresh_token=') &&
                        window.location.pathname !== '/magic-login') {
                      
                      console.log('Detected magic link with hash length:', hash.length);
                      const origin = window.location.origin;
                      console.log('Redirecting to magic login page');
                      window.location.href = origin + '/magic-login' + hash;
                    }
                  }
                } catch (e) {
                  console.error('Error in magic link detection script:', e);
                }
              })();
            `
          }} />
        </body>
      </Html>
    );
  }
}

// Static metadata generator for specific pages
function generateStaticMetadata(page) {
  const baseUrl = "https://merrouchgaming.com";
  
  const pageMetadata = {
    dashboard: {
      title: "Gaming Dashboard | Merrouch Gaming Center",
      description: "Manage your gaming profile, view your clips, check your achievements, and stay updated with the latest gaming events at Merrouch Gaming Center in Tangier.",
      keywords: "gaming dashboard, profile management, gaming achievements, Merrouch Gaming, Tangier"
    },
    shop: {
      title: "Gaming Shop | Buy Gaming Time & Products | Merrouch Gaming",
      description: "Purchase gaming time, energy drinks, snacks, and gaming accessories at Merrouch Gaming Center. Competitive prices and instant delivery to your gaming station.",
      keywords: "gaming shop, buy gaming time, energy drinks, snacks, gaming accessories, Merrouch Gaming, Tangier"
    },
    events: {
      title: "Gaming Events & Tournaments | Merrouch Gaming Center",
      description: "Join exciting gaming tournaments and events at Merrouch Gaming Center in Tangier. Compete in popular games, win prizes, and connect with fellow gamers.",
      keywords: "gaming events, tournaments, gaming competitions, esports events, Merrouch Gaming, Tangier"
    },
    upload: {
      title: "Upload Gaming Clips | Share Your Best Moments | Merrouch Gaming",
      description: "Upload and share your best gaming moments from your sessions at Merrouch Gaming Center. Show off your skills and connect with the gaming community.",
      keywords: "upload gaming clips, share gaming moments, gaming highlights, Merrouch Gaming, Tangier"
    },
    awards: {
      title: "Gaming Achievements & Awards | Merrouch Gaming Center",
      description: "View your gaming achievements, unlock new awards, and track your progress at Merrouch Gaming Center. See what you've accomplished and what's next.",
      keywords: "gaming achievements, awards, gaming progress, gaming milestones, Merrouch Gaming, Tangier"
    },
    avcomputers: {
      title: "Available Gaming PCs | Real-time Status | Merrouch Gaming",
      description: "Check real-time availability of our RTX 3070 gaming PCs, reserve your gaming station, and see current queue status at Merrouch Gaming Center in Tangier.",
      keywords: "available gaming PCs, RTX 3070 availability, gaming station reservation, queue status, Merrouch Gaming, Tangier"
    },
    topusers: {
      title: "Top Gaming Users | Leaderboards | Merrouch Gaming Center",
      description: "Discover the top gaming users, view leaderboards, and see who's dominating the gaming scene at Merrouch Gaming Center in Tangier.",
      keywords: "top gaming users, leaderboards, gaming rankings, best players, Merrouch Gaming, Tangier"
    },
    home: {
      title: "Premium Gaming Center Tangier | RTX 3070 Gaming PCs & eSports",
      description: "Top-rated gaming center in Tangier with RTX 3070 PCs, 200Mbps internet, and competitive prices. Gaming café près de vous à Tanger. مقهى الألعاب في طنجة. Join our gaming community!",
      keywords: "gaming center tangier, cyber cafe tanger, RTX 3070 gaming, gaming cafe morocco, esports tangier, internet cafe near me, gaming center near me, cyber gaming tanger, salle de jeux tanger, قاعة العاب طنجة, مقهى الانترنت في طنجة, gaming pc rental tangier, competitive gaming morocco"
    },
    admin: {
      title: "Admin Panel | Merrouch Gaming Center",
      description: "Administrative panel for managing Merrouch Gaming Center operations, users, events, and system settings.",
      keywords: "admin panel, gaming center management, system administration, Merrouch Gaming, Tangier"
    }
  };

  const page_info = pageMetadata[page];
  if (!page_info) return null;

  // Use LocalBusiness schema for home page, WebPage for others
  const structuredData = page === 'home' ? {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Cyber Merrouch Gaming Center",
    "description": page_info.description,
    "image": `${baseUrl}/top.jpg`,
    "url": baseUrl,
    "telephone": "+212531098983",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1",
      "addressLocality": "Tangier",
      "addressRegion": "Tanger-Tetouan-Al Hoceima",
      "postalCode": "90060",
      "addressCountry": "MA"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 35.768787,
      "longitude": -5.8102713
    },
    "priceRange": "$$",
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
    ]
  } : {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": page_info.title,
    "description": page_info.description,
    "url": `${baseUrl}/${page}`,
    "image": `${baseUrl}/top.jpg`,
    "publisher": {
      "@type": "Organization",
      "name": "Merrouch Gaming",
      "url": baseUrl
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": baseUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": page_info.title.split('|')[0].trim(),
          "item": `${baseUrl}/${page}`
        }
      ]
    }
  };

  return {
    title: page_info.title,
    description: page_info.description,
    image: `${baseUrl}/top.jpg`,
    url: page === 'home' ? baseUrl : `${baseUrl}/${page}`,
    type: "website",
    keywords: page_info.keywords,
    structuredData
  };
}

// Universal metadata generator for all dynamic pages
async function generateDynamicMetadata(ctx) {
  const { pathname, query } = ctx;
  
  try {
    // Only attempt Supabase operations for dynamic pages that need database data
    const needsDatabase = ['/discover', '/profile/[username]', '/clip/[id]', '/events/[id]', '/events/[id]/bracket'].includes(pathname);
    
    if (!needsDatabase) {
      // For static pages, use static metadata generator
      const pageMap = {
        '/dashboard': 'dashboard',
        '/shop': 'shop',
        '/events': 'events',
        '/upload': 'upload',
        '/awards': 'awards',
        '/avcomputers': 'avcomputers',
        '/topusers': 'topusers',
        '/': 'home'
      };
      
      const pageName = pageMap[pathname] || (pathname.startsWith('/admin') ? 'admin' : null);
      if (pageName) {
        return generateStaticMetadata(pageName);
      }
      return null;
    }

    // Import Supabase client only for database-dependent pages
    const { createClient } = await import('../utils/supabase/server-props');
    
    // Add safety checks for request/response objects
    if (!ctx.req || !ctx.res) {
      console.warn('Missing req/res objects in _document.js getInitialProps');
      return null;
    }
    
    const supabase = createClient({ req: ctx.req, res: ctx.res });
    
    // Route-specific metadata generation for database-dependent pages
    if (pathname === '/discover') {
      return await generateDiscoverMetadata(supabase);
    } else if (pathname === '/profile/[username]') {
      return await generateProfileMetadata(supabase, query.username);
    } else if (pathname === '/clip/[id]') {
      return await generateClipMetadata(supabase, query.id);
    } else if (pathname === '/events/[id]') {
      return await generateEventMetadata(supabase, query.id);
    } else if (pathname === '/events/[id]/bracket') {
      return await generateBracketMetadata(supabase, query.id);
    }
    
    return null;
  } catch (error) {
    console.error('Error generating dynamic metadata:', error);
    // Return null instead of crashing - fallback to default metadata
    return null;
  }
}

// Discover page metadata
async function generateDiscoverMetadata(supabase) {
  try {
    // Add error handling for database queries
    const [{ count }, { data: latestClips }] = await Promise.all([
      supabase.from('clips').select('id', { count: 'exact' }).eq('visibility', 'public').then(result => result || { count: 0 }),
      supabase.from('clips').select('thumbnail_path, cloudflare_uid, title, game, username, uploaded_at').eq('visibility', 'public').order('uploaded_at', { ascending: false }).limit(3).then(result => result || { data: [] })
    ]).catch((error) => {
      console.error('Database query error in generateDiscoverMetadata:', error);
      return [{ count: 0 }, { data: [] }];
    });

    const totalClips = count || 0;
    const latestClip = latestClips?.[0];
    
    const dynamicImage = latestClip?.cloudflare_uid 
      ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${latestClip.cloudflare_uid}/thumbnails/thumbnail.jpg`
      : latestClip?.thumbnail_path || 'https://merrouchgaming.com/top.jpg';

    const dynamicTitle = latestClip 
      ? `${totalClips} Gaming Highlights | Latest: ${latestClip.title || latestClip.game || 'Gaming Clip'}`
      : `Discover ${totalClips} Gaming Highlights | RTX 3070 Gaming Clips`;

    let dynamicDescription = `Watch ${totalClips} amazing gaming moments from our community. High-quality clips recorded on RTX 3070 PCs at Merrouch Gaming Center.`;
    
    if (latestClips?.length) {
      const recentGames = [...new Set(latestClips.map(clip => clip.game).filter(Boolean))].slice(0, 3);
      const recentPlayers = [...new Set(latestClips.map(clip => clip.username).filter(Boolean))].slice(0, 2);
      
      if (recentGames.length) {
        dynamicDescription += ` Latest highlights from ${recentGames.join(', ')}.`;
      }
      if (recentPlayers.length) {
        dynamicDescription += ` Featured players: ${recentPlayers.join(', ')}.`;
      }
    }

    return {
      title: dynamicTitle,
      description: dynamicDescription,
      image: dynamicImage,
      url: "https://merrouchgaming.com/discover",
      type: "website",
      keywords: `gaming clips, ${latestClip?.game || 'gaming'}, RTX 3070, Merrouch Gaming, Tangier`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": dynamicTitle,
        "description": dynamicDescription,
        "numberOfItems": totalClips,
        "provider": {
          "@type": "Organization",
          "name": "Merrouch Gaming",
          "url": "https://merrouchgaming.com"
        },
        "image": dynamicImage,
        "url": "https://merrouchgaming.com/discover",
        ...(latestClip && {
          "mainEntity": {
            "@type": "VideoObject",
            "name": latestClip.title || latestClip.game,
            "thumbnailUrl": dynamicImage,
            "uploadDate": latestClip.uploaded_at,
            "genre": latestClip.game
          }
        })
      }
    };
  } catch (error) {
    console.error('Error generating discover metadata:', error);
    return {
      title: "Discover Gaming Highlights | RTX 3070 Gaming Clips",
      description: "Watch the best gaming moments from our community. High-quality gaming clips recorded on RTX 3070 PCs at Merrouch Gaming Center in Tangier.",
      image: "https://merrouchgaming.com/top.jpg",
      url: "https://merrouchgaming.com/discover",
      type: "website",
      keywords: "gaming clips, RTX 3070, Merrouch Gaming, Tangier"
    };
  }
}

// Profile page metadata
async function generateProfileMetadata(supabase, username) {
  try {
    const normalizedUsername = username.toLowerCase();
    
    // Get user data
    const { data: userData } = await supabase
      .from('users')
      .select('id, username, favorite_game, points')
      .eq('username', normalizedUsername)
      .single();

    if (!userData) {
      return {
        title: `Gaming Profile | Merrouch Gaming Center`,
        description: "This user profile could not be found.",
        image: "https://merrouchgaming.com/top.jpg",
        url: `https://merrouchgaming.com/profile/${normalizedUsername}`,
        type: "profile",
        keywords: "gaming profile, Merrouch Gaming, Tangier"
      };
    }

    // Get clips count and latest clip
    const [{ count: clipsCount }, { data: latestClip }] = await Promise.all([
      supabase.from('clips').select('id', { count: 'exact' }).eq('user_id', userData.id).eq('visibility', 'public'),
      supabase.from('clips').select('title, thumbnail_path, cloudflare_uid, game, views_count, likes_count').eq('user_id', userData.id).eq('visibility', 'public').order('uploaded_at', { ascending: false }).limit(1).single()
    ]);

    // Get events count
    const { count: eventsCount } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact' })
      .eq('user_id', userData.id);

    const profileImage = latestClip?.cloudflare_uid 
      ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${latestClip.cloudflare_uid}/thumbnails/thumbnail.jpg`
      : latestClip?.thumbnail_path || "https://merrouchgaming.com/top.jpg";

    let userDescription = `${normalizedUsername}'s gaming profile at Merrouch Gaming Center`;
    
    if (userData.favorite_game) {
      userDescription += ` | ${userData.favorite_game} Player`;
    }
    
    if (clipsCount) {
      userDescription += ` featuring ${clipsCount} public gaming ${clipsCount === 1 ? 'clip' : 'clips'}`;
    }
    
    if (eventsCount) {
      userDescription += ` and participation in ${eventsCount} ${eventsCount === 1 ? 'event' : 'events'}`;
    }
    
    if (latestClip?.title) {
      userDescription += `. Latest clip: "${latestClip.title}"`;
      if (latestClip.game) {
        userDescription += ` in ${latestClip.game}`;
      }
    }
    
    userDescription += `. Check out their gaming achievements!`;

    return {
      title: `${normalizedUsername}'s Gaming Profile | Merrouch Gaming Center`,
      description: userDescription,
      image: profileImage,
      url: `https://merrouchgaming.com/profile/${normalizedUsername}`,
      type: "profile",
      keywords: `${normalizedUsername}, gaming profile, ${userData.favorite_game || 'gaming'}, Merrouch Gaming, Tangier`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "name": `${normalizedUsername}'s Gaming Profile`,
        "description": userDescription,
        "mainEntity": {
          "@type": "Person",
          "name": normalizedUsername,
          "image": profileImage,
          "url": `https://merrouchgaming.com/profile/${normalizedUsername}`,
          ...(userData.favorite_game && {
            "knowsAbout": userData.favorite_game
          })
        }
      }
    };
  } catch (error) {
    console.error('Error generating profile metadata:', error);
    return {
      title: `Gaming Profile | Merrouch Gaming Center`,
      description: "View this user's gaming profile, achievements, and statistics at Merrouch Gaming Center.",
      image: "https://merrouchgaming.com/top.jpg",
      url: `https://merrouchgaming.com/profile/${username}`,
      type: "profile",
      keywords: "gaming profile, Merrouch Gaming, Tangier"
    };
  }
}

// Clip page metadata
async function generateClipMetadata(supabase, clipId) {
  try {
    const { data: clip } = await supabase
      .from('clips')
      .select('*')
      .eq('id', clipId)
      .single();

    if (!clip) {
      return {
        title: 'Clip Not Found | Merrouch Gaming',
        description: 'This clip may have been deleted or does not exist.',
        image: 'https://merrouchgaming.com/top.jpg',
        url: `https://merrouchgaming.com/clip/${clipId}`,
        type: 'website',
        keywords: 'gaming clip, Merrouch Gaming, Tangier'
      };
    }

    const thumbnailUrl = clip.cloudflare_uid
      ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`
      : clip.thumbnail_path || 'https://merrouchgaming.com/top.jpg';

    const description = `Watch this amazing gaming moment by ${clip.username} at Merrouch Gaming Center. ${
      clip.views_count ? `${clip.views_count.toLocaleString()} views` : ''
    }${clip.likes_count ? `, ${clip.likes_count.toLocaleString()} likes` : ''
    }. High-quality gaming clips from our RTX 3070 gaming PCs.`;

    return {
      title: `${clip.title} | Gaming Clip by ${clip.username}`,
      description: description,
      image: thumbnailUrl,
      url: `https://merrouchgaming.com/clip/${clipId}`,
      type: 'video.other',
      keywords: `${clip.game || 'gaming'}, ${clip.username}, gaming clip, Merrouch Gaming, Tangier`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": clip.title,
        "description": description,
        "thumbnailUrl": thumbnailUrl,
        "uploadDate": clip.uploaded_at,
        "contentUrl": `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/watch`,
        "interactionStatistic": [
          {
            "@type": "InteractionCounter",
            "interactionType": "http://schema.org/WatchAction",
            "userInteractionCount": clip.views_count || 0
          },
          {
            "@type": "InteractionCounter",
            "interactionType": "http://schema.org/LikeAction",
            "userInteractionCount": clip.likes_count || 0
          }
        ],
        "author": {
          "@type": "Person",
          "name": clip.username
        }
      }
    };
  } catch (error) {
    console.error('Error generating clip metadata:', error);
    return {
      title: 'Gaming Clip | Merrouch Gaming',
      description: 'Watch amazing gaming moments from our community at Merrouch Gaming Center.',
      image: 'https://merrouchgaming.com/top.jpg',
      url: `https://merrouchgaming.com/clip/${clipId}`,
      type: 'video.other',
      keywords: 'gaming clip, Merrouch Gaming, Tangier'
    };
  }
}

// Event page metadata
async function generateEventMetadata(supabase, eventId) {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) {
      return {
        title: "Event Not Found | Merrouch Gaming Center",
        description: "The gaming event you're looking for doesn't exist or has been removed.",
        image: "https://merrouchgaming.com/top.jpg",
        url: `https://merrouchgaming.com/events/${eventId}`,
        type: "website",
        keywords: "gaming event, tournament, Merrouch Gaming, Tangier"
      };
    }

    const formattedDate = event.date ? new Date(event.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }) : 'TBD';

    const description = `${event.status} gaming ${event.team_type} tournament: ${event.game || 'Gaming'} on ${formattedDate}. ${event.description ? event.description.substring(0, 150) + '...' : 'Join our gaming event!'}`;

    return {
      title: `${event.title} | Gaming Event | Merrouch Gaming`,
      description: description,
      image: event.image || "https://merrouchgaming.com/top.jpg",
      url: `https://merrouchgaming.com/events/${eventId}`,
      type: "event",
      keywords: `${event.game || 'gaming'}, tournament, ${event.team_type}, Merrouch Gaming, Tangier`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": event.title,
        "description": description,
        "startDate": event.date,
        "location": {
          "@type": "Place",
          "name": "Merrouch Gaming Center",
          "address": "Tangier, Morocco"
        },
        "organizer": {
          "@type": "Organization",
          "name": "Merrouch Gaming"
        },
        "image": event.image || "https://merrouchgaming.com/top.jpg"
      }
    };
  } catch (error) {
    console.error('Error generating event metadata:', error);
    return {
      title: "Gaming Event | Merrouch Gaming Center",
      description: "Join our gaming tournaments and events at Merrouch Gaming Center in Tangier.",
      image: "https://merrouchgaming.com/top.jpg",
      url: `https://merrouchgaming.com/events/${eventId}`,
      type: "event",
      keywords: "gaming event, tournament, Merrouch Gaming, Tangier"
    };
  }
}

// Bracket page metadata
async function generateBracketMetadata(supabase, eventId) {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('title, game, team_type, status')
      .eq('id', eventId)
      .single();

    if (!event) {
      return {
        title: "Tournament Bracket | Merrouch Gaming Center",
        description: "View tournament brackets and results at Merrouch Gaming Center.",
        image: "https://merrouchgaming.com/top.jpg",
        url: `https://merrouchgaming.com/events/${eventId}/bracket`,
        type: "website",
        keywords: "tournament bracket, gaming, Merrouch Gaming, Tangier"
      };
    }

    const description = `View the tournament bracket for ${event.title} - ${event.game || 'Gaming'} ${event.team_type} tournament. Track match results and see who advances to the finals!`;

    return {
      title: `${event.title} Bracket | Tournament Results | Merrouch Gaming`,
      description: description,
      image: "https://merrouchgaming.com/top.jpg",
      url: `https://merrouchgaming.com/events/${eventId}/bracket`,
      type: "website",
      keywords: `${event.game || 'gaming'}, tournament bracket, ${event.team_type}, Merrouch Gaming, Tangier`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": `${event.title} Bracket`,
        "description": description,
        "sport": event.game || "Gaming",
        "location": {
          "@type": "Place",
          "name": "Merrouch Gaming Center",
          "address": "Tangier, Morocco"
        }
      }
    };
  } catch (error) {
    console.error('Error generating bracket metadata:', error);
    return {
      title: "Tournament Bracket | Merrouch Gaming Center",
      description: "View tournament brackets and results at Merrouch Gaming Center.",
      image: "https://merrouchgaming.com/top.jpg",
      url: `https://merrouchgaming.com/events/${eventId}/bracket`,
      type: "website",
      keywords: "tournament bracket, gaming, Merrouch Gaming, Tangier"
    };
  }
}

export default MyDocument;
