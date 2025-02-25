// Unified configuration for routes and page settings
export const ROUTE_CONFIG = {
  '/': {
    public: true,
    requireAuth: false,
    showNavigation: true,
    showSearch: true
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

  '/topusers': {
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
    requireAuth: false,
    showNavigation: true
  },

  '/profile/[username]': {
    public: true,
    requireAuth: false,
    showNavigation: true,
    showSearch: true
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