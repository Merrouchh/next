export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
  is_admin?: boolean;
  isAdmin?: boolean; // Alias for is_admin that's used in some places
  phone?: string; // New phone field
  gizmo_id?: string;
}

// For AuthContext
export interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

// For form state
export interface WebsiteAccountForm {
  email: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  currentPasswordForPasswordChange: string;
} 