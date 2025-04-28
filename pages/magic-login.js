import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

export default function MagicLogin() {
  const router = useRouter();
  const { user, forceSessionReload } = useAuth();
  const [status, setStatus] = useState("Processing login...");
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;
    
    // If already logged in, redirect to dashboard
    if (user) {
      console.log('User already logged in, redirecting to dashboard');
      window.location.href = '/dashboard';
      return;
    }
    
    const processAuth = async () => {
      try {
        console.log("Starting magic link processing");
        
        // Get the hash part of the URL
        const hash = window.location.hash;
        if (!hash) {
          setError("No authentication data found in URL");
          return;
        }
        
        console.log("Found hash in URL, length:", hash.length);
        
        // Parse the hash to get auth tokens
        const hashParams = new URLSearchParams(hash.substring(1));
        
        // Debug log all hash parameters (without exposing sensitive values)
        const paramKeys = Array.from(hashParams.keys());
        console.log("Hash params keys:", paramKeys);
        
        // Extract access and refresh tokens
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        // Check if we have the necessary tokens
        if (!accessToken || !refreshToken) {
          console.error("Missing required tokens in hash");
          setError("Missing authentication tokens");
          return;
        }
        
        console.log("Found required tokens, initializing auth");
        setStatus("Setting up your authentication...");
        
        // Create a standalone Supabase client for setting up session
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              storage: localStorage
            }
          }
        );
        
        // Step 1: Set the session with the tokens
        console.log("Setting auth session with tokens");
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (sessionError) {
          console.error("Session setup failed:", sessionError);
          setError(`Authentication failed: ${sessionError.message}`);
          return;
        }
        
        console.log("Session set successfully, checking user");
        
        // Verify the session was set up correctly
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error("User verification failed:", userError);
          setError("Could not verify your identity");
          return;
        }
        
        console.log("User authenticated successfully:", user.email);
        setStatus("Session established, loading user data...");
        
        // Clean up URL hash
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Force reload of auth state using the context's function
        console.log("Forcing reload of auth state from the context");
        const { success, error: reloadError } = await forceSessionReload();
        
        if (!success) {
          console.error("Failed to reload auth state:", reloadError);
          setStatus("Authentication successful! Redirecting to dashboard...");
          
          // Even if the state reload failed, try redirecting to dashboard
          // The dashboard should still be able to pick up the session
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
          return;
        }
        
        console.log("Auth state reloaded successfully, redirecting to dashboard");
        setStatus("Login successful! Redirecting...");
        
        // Redirect to dashboard with delay for UI feedback
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } catch (err) {
        console.error("Unexpected error during auth processing:", err);
        setError(`Authentication error: ${err.message}`);
      }
    };
    
    processAuth();
  }, [user, router, forceSessionReload]);
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#111',
      color: '#fff'
    }}>
      <Head>
        <title>{error ? 'Login Failed' : 'Logging In'} - Merrouch Gaming</title>
      </Head>
      
      {error ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ color: '#FFD700', marginBottom: '1.5rem' }}>Login Failed</h1>
          <p style={{ marginBottom: '1rem' }}>{error}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', color: '#888' }}>
            Please try logging in again or contact support if the problem persists.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              background: '#FFD700',
              color: '#000',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginTop: '1rem'
            }}
          >
            Return to Homepage
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#FFD700', marginBottom: '1rem' }}>Logging In</h2>
          <p>{status}</p>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 215, 0, 0.1)',
            borderLeft: '4px solid #FFD700',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginTop: '1rem'
          }}></div>
          <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
} 