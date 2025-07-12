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
    
    return (
      <Html lang="en">
        <Head>
          {/* UNIVERSAL DYNAMIC METADATA INJECTION - WORKS FOR ALL SOCIAL MEDIA CRAWLERS */}
          {dynamicMetadata && (
            <>
              <title>{dynamicMetadata.title}</title>
              <meta name="description" content={dynamicMetadata.description} />
              
              {/* Open Graph tags */}
              <meta property="og:title" content={dynamicMetadata.title} />
              <meta property="og:description" content={dynamicMetadata.description} />
              <meta property="og:image" content={dynamicMetadata.image} />
              <meta property="og:url" content={dynamicMetadata.url} />
              <meta property="og:type" content={dynamicMetadata.type} />
              <meta property="og:site_name" content="Merrouch Gaming" />
              
              {/* Twitter Card */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:site" content="@merrouchgaming" />
              <meta name="twitter:title" content={dynamicMetadata.title} />
              <meta name="twitter:description" content={dynamicMetadata.description} />
              <meta name="twitter:image" content={dynamicMetadata.image} />
              
              {/* Additional metadata */}
              <meta name="keywords" content={dynamicMetadata.keywords} />
              <meta name="robots" content="index, follow" />
              <meta name="author" content="Merrouch Gaming" />
              <link rel="canonical" href={dynamicMetadata.url} />
              
              {/* Structured Data */}
              {dynamicMetadata.structuredData && (
                <script 
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify(dynamicMetadata.structuredData)
                  }}
                />
              )}
            </>
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
          
          {/* Media Chrome and HLS */}
          <script 
            type="module" 
            src="https://cdn.jsdelivr.net/npm/media-chrome@1.5.1/+esm"
          />
          <script 
            type="module" 
            src="https://cdn.jsdelivr.net/npm/hls-video-element@1.2/+esm"
          />
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

// Universal metadata generator for all dynamic pages
async function generateDynamicMetadata(ctx) {
  const { pathname, query } = ctx;
  
  try {
    // Import Supabase client
    const { createClient } = await import('../utils/supabase/server-props');
    const supabase = createClient({ req: ctx.req, res: ctx.res });
    
    // Route-specific metadata generation
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
    return null;
  }
}

// Discover page metadata
async function generateDiscoverMetadata(supabase) {
  try {
    const [{ count }, { data: latestClips }] = await Promise.all([
      supabase.from('clips').select('id', { count: 'exact' }).eq('visibility', 'public'),
      supabase.from('clips').select('thumbnail_path, cloudflare_uid, title, game, username, uploaded_at').eq('visibility', 'public').order('uploaded_at', { ascending: false }).limit(3)
    ]);

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
