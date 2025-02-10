// Unified configuration for routes and page settings
export const ROUTE_CONFIG = {
  // Public routes
  '/': {
    public: true,
    singleHeader: false,
    requireAuth: false,
    hasBottomNav: true
  },

  '/discover': {
    public: true,
    singleHeader: false,
    requireAuth: false,
    hasBottomNav: true
  },

  '/dashboard': {
    public: false,
    singleHeader: false,
    requireAuth: true,
    hasBottomNav: true
  },

  '/upload': {
    public: false,
    singleHeader: true,
    requireAuth: true
  },

  '/shop': {
    public: true,
    singleHeader: false,
    requireAuth: false,
    hasBottomNav: true
  },

  '/topusers': {
    public: true,
    singleHeader: false,
    requireAuth: false,
    hasBottomNav: true
  },

  '/avcomputers': {
    public: false,
    singleHeader: false,
    requireAuth: true,
    hasBottomNav: true
  },

  // Default configuration
  default: {
    public: true,
    singleHeader: false,
    requireAuth: false,
    hasBottomNav: true
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
      hasBottomNav: true
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