// Unified configuration for routes and page settings
export const ROUTE_CONFIG = {
  // Public routes
  '/': {
    public: true,
    singleHeader: true,
    requireAuth: false,
    mobileTopPadding: {
      loggedIn: '3rem',
      loggedOut: '3rem'
    },
    tabletTopPadding: {
      loggedIn: '3.5rem',
      loggedOut: '3.5rem'
    },
    desktopTopPadding: {
      loggedIn: '4rem',
      loggedOut: '4rem'
    }
  },

  '/discover': {
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

  '/dashboard': {
    public: false,
    singleHeader: false,
    requireAuth: true,
    mobileTopPadding: {
      loggedIn: '4rem',
      loggedOut: '3rem'
    },
    tabletTopPadding: {
      loggedIn: '4rem',
      loggedOut: '3.5rem'
    },
    desktopTopPadding: {
      loggedIn: '3rem',
      loggedOut: '4rem'
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

  '/voicechat': {
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
      loggedIn: '4rem',
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
        loggedIn: '12rem',
        loggedOut: '6rem'
      },
      tabletTopPadding: {
        loggedIn: '12rem',
        loggedOut: '6rem'
      },
      desktopTopPadding: {
        loggedIn: '8rem',
        loggedOut: '4rem'
      }
    };
  }
  
  if (clipRegex.test(pathname)) {
    return {
      ...ROUTE_CONFIG.default,
      singleHeader: true,
      mobileTopPadding: {
        loggedIn: '3rem',
        loggedOut: '3rem'
      },
      tabletTopPadding: {
        loggedIn: '3.5rem',
        loggedOut: '3.5rem'
      },
      desktopTopPadding: {
        loggedIn: '4rem',
        loggedOut: '4rem'
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