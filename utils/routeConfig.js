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

  '/awards': {
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

  // Admin pages - Simplified permission structure
  '/admin': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },
  
  '/admin/events': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },
  
  '/admin/users': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },
  
  '/admin/sessions': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },

  // Staff can access queue management
  '/admin/queue': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    allowStaff: true,
    showNavigation: true,
    adminPage: true
  },

  '/admin/stats': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },

  '/admin/achievements': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },

  '/admin/events/registrations/[id]': {
    public: false,
    requireAuth: true,
    requireAdmin: true,
    showNavigation: true,
    adminPage: true
  },

  // Auth verification pages
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
  
  // Special handling for admin pages
  if (pathname.startsWith('/admin/')) {
    // Special handling for event registrations
    if (pathname.includes('/events/registrations/')) {
      return ROUTE_CONFIG['/admin/events/registrations/[id]'];
    }
    
    // Check for specific admin routes
    const specificAdminRoute = ROUTE_CONFIG[pathname];
    if (specificAdminRoute) {
      return specificAdminRoute;
    }
    
    // Default admin route
    return ROUTE_CONFIG['/admin'] || {
      public: false,
      requireAuth: true,
      requireAdmin: true,
      showNavigation: true,
      adminPage: true
    };
  }

  // Special handling for auth pages
  if (pathname.startsWith('/auth/')) {
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

export const hasSearchHeader = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.hasSearchHeader || false;
};

export const isAuthPage = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.isAuthPage || false;
};

export const isAdminPage = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.adminPage || false;
};

export const requiresAdmin = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.requireAdmin || false;
};

// Helper to check if staff can access a route
export const allowsStaff = (pathname) => {
  const config = getRouteConfig(pathname);
  return config.allowStaff || false;
}; 