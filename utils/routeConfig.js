// Unified configuration for routes and page settings
export const ROUTE_CONFIG = {
  '/': {
    public: true,
    requireAuth: false,
    showNavigation: false,
    hasSearchHeader: true
  },

  '/discover': {
    public: true,
    requireAuth: false,
    showNavigation: true
  },

  '/dashboard': {
    public: false,
    requireAuth: true,
    showNavigation: true
  },

  '/upload': {
    public: false,
    requireAuth: true,
    showNavigation: false
  },

  '/shop': {
    public: true,
    requireAuth: false,
    showNavigation: true
  },

  '/magic-login': {
    public: true,
    requireAuth: false,
    showNavigation: false,
    isAuthPage: true
  },

  '/topusers': {
    public: true,
    requireAuth: false,
    showNavigation: true
  },

  '/events': {
    public: true,
    requireAuth: false,
    showNavigation: true
  },
  
  '/events/[id]': {
    public: true,
    requireAuth: false,
    showNavigation: true
  },

  '/avcomputers': {
    public: false,
    requireAuth: true,
    showNavigation: true
  },

  '/editprofile': {
    public: false,
    requireAuth: true,
    showNavigation: true
  },

  '/profile/[username]': {
    public: true,
    requireAuth: false,
    showNavigation: true,
    hasSearchHeader: true
  },

  // Add auth verification pages
  '/auth/verification-success': {
    public: true,
    requireAuth: false,
    showNavigation: false,
    isAuthPage: true
  },

  '/auth/verification-failed': {
    public: true,
    requireAuth: false,
    showNavigation: false,
    isAuthPage: true
  },

  '/auth/callback': {
    public: true,
    requireAuth: false,
    showNavigation: false,
    isAuthPage: true
  },

  '/auth/confirm': {
    public: true,
    requireAuth: false,
    showNavigation: false,
    isAuthPage: true
  },

  // Default configuration
  default: {
    public: true,
    requireAuth: false,
    showNavigation: false
  }
};

// Helper functions
export const getRouteConfig = (pathname) => {
  // Special handling for profile pages
  if (pathname.startsWith('/profile/')) {
    return ROUTE_CONFIG['/profile/[username]'];
  }
  
  // Special handling for event detail pages
  if (pathname.startsWith('/events/') && pathname !== '/events') {
    return ROUTE_CONFIG['/events/[id]'];
  }

  // Special handling for auth pages
  if (pathname.startsWith('/auth/')) {
    // Use specific config if available, otherwise use a general auth config
    return ROUTE_CONFIG[pathname] || {
      public: true,
      requireAuth: false,
      showNavigation: false,
      isAuthPage: true
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

// Add hasSearchHeader to the helper functions
export const hasSearchHeader = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.hasSearchHeader || false;
};

// Add helper for auth pages
export const isAuthPage = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.isAuthPage || false;
}; 