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
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;
    
    // If already logged in, redirect to dashboard
    if (user) {
      console.log('User already logged in, redirecting to dashboard');
      setStatus("You're already logged in! Redirecting...");
      
      // Use both methods for better mobile compatibility
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          try {
            router.replace('/dashboard');
          } catch (routerError) {
            console.log("Router failed, using window.location");
            window.location.href = '/dashboard';
          }
        }
      }, 500);
      return;
    }
    
    const processAuth = async () => {
      try {
        // Prevent multiple processing
        if (isProcessing) {
          console.log("Already processing, skipping...");
          return;
        }
        
        setIsProcessing(true);
        console.log("Starting magic link processing");
        
        // Get the hash part of the URL
        const hash = window.location.hash;
        if (!hash) {
          setError("No authentication data found in URL");
          setIsProcessing(false);
          return;
        }
        
        console.log("Found hash in URL, length:", hash.length);
        
        // Parse the hash to get auth tokens
        const hashParams = new URLSearchParams(hash.substring(1));
        
        // Debug log all hash parameters (without exposing sensitive values)
        const paramKeys = Array.from(hashParams.keys());
        console.log("Hash params keys:", paramKeys);
        
        // Check if this is a password recovery session
        const type = hashParams.get('type');
        if (type === 'recovery') {
          console.log("Password recovery session detected - redirecting to reset password page");
          setStatus("Password recovery detected. Redirecting to reset password form...");
          
          // Preserve the hash tokens when redirecting to reset password page
          const resetPasswordUrl = '/auth/reset-password' + window.location.hash;
          
          // Redirect to reset password page with a slight delay, preserving tokens
          setTimeout(() => {
            router.replace(resetPasswordUrl);
          }, 500);
          return;
        }
        
        // Extract access and refresh tokens
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        // Check if we have the necessary tokens
        if (!accessToken || !refreshToken) {
          console.error("Missing required tokens in hash");
          setError("Missing authentication tokens");
          setIsProcessing(false);
          return;
        }
        
        console.log("Found required tokens, initializing auth");
        setStatus("Setting up your authentication...");
        
        // Create a standalone Supabase client for setting up session
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY,
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
          setIsProcessing(false);
          return;
        }
        
        console.log("Session set successfully, checking user");
        
        // Verify the session was set up correctly
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error("User verification failed:", userError);
          setError("Could not verify your identity");
          setIsProcessing(false);
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
          // Use a shorter delay for mobile to reduce perceived loading time
          setTimeout(() => {
            // Use both methods for better mobile compatibility
            if (typeof window !== 'undefined') {
              try {
                router.replace('/dashboard');
              } catch (routerError) {
                console.log("Router failed, using window.location");
                window.location.href = '/dashboard';
              }
            }
            setIsProcessing(false);
          }, 800);
          return;
        }
        
        console.log("Auth state reloaded successfully, redirecting to dashboard");
        setStatus("Login successful! Redirecting...");
        
        // Redirect to dashboard with shorter delay for better mobile experience
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            try {
              // Try router first for better UX
              router.replace('/dashboard');
            } catch (routerError) {
              console.log("Router failed, using window.location");
              window.location.href = '/dashboard';
            }
          }
          setIsProcessing(false);
        }, 600);
      } catch (err) {
        console.error("Unexpected error during auth processing:", err);
        setError(`Authentication error: ${err.message}`);
      } finally {
        setIsProcessing(false);
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
      minWidth: '100vw',
      background: '#111',
      color: '#fff',
      padding: '1rem',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999
    }}>
      <Head>
        <title>{error ? 'Login Failed' : 'Logging In'} - Merrouch Gaming</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>{`
          body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            background: #111;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </Head>
      
      {error ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '12px',
          border: '1px solid #333'
        }}>
          <h1 style={{ 
            color: '#FFD700', 
            marginBottom: '1.5rem',
            fontSize: '1.5rem',
            fontWeight: '600'
          }}>Login Failed</h1>
          <p style={{ 
            marginBottom: '1rem',
            fontSize: '1rem',
            lineHeight: '1.4'
          }}>{error}</p>
          <p style={{ 
            fontSize: '0.9rem', 
            marginBottom: '1.5rem', 
            color: '#888',
            lineHeight: '1.4'
          }}>
            Please try logging in again or contact support if the problem persists.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              background: '#FFD700',
              color: '#000',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
              width: '100%',
              maxWidth: '200px',
              transition: 'all 0.2s ease',
              touchAction: 'manipulation'
            }}
            onMouseOver={(e) => e.target.style.background = '#e6c200'}
            onMouseOut={(e) => e.target.style.background = '#FFD700'}
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
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '12px',
          border: '1px solid #333'
        }}>
          <h2 style={{ 
            color: '#FFD700', 
            marginBottom: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: '600'
          }}>Logging In</h2>
          <p style={{ 
            fontSize: '1rem',
            lineHeight: '1.4',
            color: '#ccc',
            margin: '0'
          }}>{status}</p>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255, 215, 0, 0.2)',
            borderLeft: '4px solid #FFD700',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginTop: '0.5rem'
          }}></div>
          <div style={{
            fontSize: '0.9rem',
            color: '#888',
            animation: 'pulse 2s ease-in-out infinite',
            marginTop: '1rem'
          }}>
            Please wait while we log you in...
          </div>
        </div>
      )}
    </div>
  );
} 