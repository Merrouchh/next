// Unified configuration for routes and page settings
export const ROUTE_CONFIG = {
  // Public routes
  '/': {
    public: true,
    singleHeader: true,
    requireAuth: false,
    mobileTopPadding: {
      loggedIn: '3rem',
      loggedOut: '2rem'
    },
    tabletTopPadding: {
      loggedIn: '3.5rem',
      loggedOut: '2rem'
    },
    desktopTopPadding: {
      loggedIn: '4rem',
      loggedOut: '2rem'
    }
  },

  '/discover': {
    public: true,
    singleHeader: false,
    requireAuth: false,
    mobileTopPadding: {
      loggedIn: '6rem',
      loggedOut: '3.5rem'
    },
    tabletTopPadding: {
      loggedIn: '6rem',
      loggedOut: '3.5rem'
    },
    desktopTopPadding: {
      loggedIn: '9rem',
      loggedOut: '5rem'
    }
  },

  '/dashboard': {
    public: false,
    singleHeader: false,
    requireAuth: true,
    mobileTopPadding: {
      loggedIn: '9rem',  // Mobile: main header (60px) + dashboard header (60px)
      loggedOut: '5rem'   // Just main header
    },
    tabletTopPadding: {
      loggedIn: '9rem',  // Tablet/Desktop: main header (80px) + dashboard header (70px)
      loggedOut: '5rem'   // Just main header
    },
    desktopTopPadding: {
      loggedIn: '12rem',   // Your custom value for desktop
      loggedOut: '5rem'   // Just main header
    }
  },

  '/upload': {
    public: false,
    singleHeader: true,
    requireAuth: true,
    mobileTopPadding: {
      loggedIn: '3rem',
      loggedOut: '3rem'
    },
    tabletTopPadding: {
      loggedIn: '3.5rem',
      loggedOut: '3.5rem'
    },
    desktopTopPadding: {
      loggedIn: '5rem',
      loggedOut: '4rem'
    }
  },

  '/shop': {
    public: true,
    singleHeader: false,
    requireAuth: false,
    mobileTopPadding: {
      loggedIn: '8rem',
      loggedOut: '3rem'
    },
    tabletTopPadding: {
      loggedIn: '8rem',
      loggedOut: '3.5rem'
    },
    desktopTopPadding: {
      loggedIn: '8rem',
      loggedOut: '4rem'
    }
  },

  // Default configuration
  default: {
    public: true,
    singleHeader: false,
    requireAuth: false,
    mobileTopPadding: {
      loggedIn: '6rem',
      loggedOut: '3rem'
    },
    tabletTopPadding: {
      loggedIn: '7rem',
      loggedOut: '3.5rem'
    },
    desktopTopPadding: {
      loggedIn: '8rem',
      loggedOut: '4rem'
    }
  }
};

// Helper functions
export const getRouteConfig = (pathname) => {
  // Improved dynamic route handling with regex
  const profileRegex = /^\/profile\/[^/]+$/;  // Matches /profile/{anything without slashes}
  const clipRegex = /^\/clip\/[^/]+$/;        // Matches /clip/{anything without slashes}

  if (profileRegex.test(pathname)) {
    return {
      ...ROUTE_CONFIG.default,
      singleHeader: false,
      requireAuth: false,
      mobileTopPadding: {
        loggedIn: '10rem',  // Mobile: main header (60px) + dashboard header (60px)
        loggedOut: '5rem'   // Just main header
      },
      tabletTopPadding: {
        loggedIn: '9rem',  // Tablet/Desktop: main header (80px) + dashboard header (70px)
        loggedOut: '5rem'   // Just main header
      },
      desktopTopPadding: {
        loggedIn: '10rem',  // Desktop: main header (80px) + dashboard header (70px)
        loggedOut: '8rem'   // Just main header
      }
    };
  }
  
  if (clipRegex.test(pathname)) {
    return {
      ...ROUTE_CONFIG.default,
      singleHeader: true,
      mobileTopPadding: {
        loggedIn: '3.5rem',
        loggedOut: '3.5rem'
      },
      tabletTopPadding: {
        loggedIn: '4rem',
        loggedOut: '4rem'
      },
      desktopTopPadding: {
        loggedIn: '4.5rem',
        loggedOut: '4.5rem'
      }
    };
  }

  return ROUTE_CONFIG[pathname] || ROUTE_CONFIG.default;
};

export const isPublicRoute = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.public;
};

export const isProtectedRoute = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.requireAuth;
}; 