import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Head from 'next/head';

// Simple loading/message component to replace LoadingScreen
const StyleWrapper = ({ message, type }) => {
  return (
    <>
      <Head>
        <title>Processing Authentication - Merrouch Gaming</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <div className="auth-message-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100%',
        background: '#0f1119',
        color: '#FFD700',
        fontSize: '1.2rem',
        textAlign: 'center',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem',
        boxSizing: 'border-box',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #333',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{
            marginBottom: '1rem',
            fontSize: '1.1rem',
            lineHeight: '1.4'
          }}>
            {message || "Processing, please wait..."}
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 215, 0, 0.2)',
            borderLeft: '3px solid #FFD700',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
        </div>
        <style jsx>{`
          body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            background: #0f1119;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
};

export default function AuthCallback() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState(null);
  
  // Process auth callback
  useEffect(() => {
    // Log for debugging
    console.log('Auth Callback Page Loaded', { 
      query: router.query,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      user: user?.email,
      isLoggedIn: !!user
    });

    const handleCallback = async () => {
      try {
        setIsProcessing(true);
        
        // First, check for the code parameter (new format)
        const { code } = router.query;
        
        if (code) {
          console.log('Processing code parameter');
          
          try {
            // If we're not logged in, we need to handle this differently
            if (!user) {
              console.log('User not logged in, need to authenticate first');
              
              // Try to exchange the code for a session
              // This approach will depend on your Supabase auth setup
              
              // Wait a bit to let any auto-processing happen
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Check if we have a session now (auto-processing might have worked)
              const { data: { session } } = await supabase.auth.getSession();
              
              if (session) {
                console.log('Session established after code processing');
                // Wait a moment for auth context to update
                await new Promise(resolve => setTimeout(resolve, 1000));
                router.replace('/auth/verification-success?type=email_change');
                return;
              } else {
                // No session, redirect to home with instructions to log in first
                setError('Please log in to complete email verification');
                setTimeout(() => {
                  router.replace('/?auth_action=login&verification_pending=true');
                }, 3000);
                return;
              }
            }
            
            // If logged in, standard process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // After a delay, check if we have a session established
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              // We have a session, this was likely a successful email change
              console.log('Session established after code processing');
              router.replace('/auth/verification-success?type=email_change');
            } else {
              // No session, something went wrong
              console.log('No session after code processing');
              router.replace('/auth/verification-failed');
            }
            return;
          } catch (error) {
            console.error('Error processing code parameter:', error);
            router.replace('/auth/verification-failed');
            return;
          }
        }
        
        // Next, check for query params (token_hash and type)
        const { token_hash, type, token } = router.query;
        
        if (token_hash && type) {
          console.log('Processing token_hash and type from query params');
          
          // If not logged in and it's an email change, need to handle differently
          if (!user && type === 'email_change') {
            console.log('User not logged in, redirecting to login first');
            setError('Please log in to complete email verification');
            setTimeout(() => {
              router.replace('/?auth_action=login&verification_pending=true');
            }, 3000);
            return;
          }
          
          // For regular verification, can proceed
          try {
            const { error } = await supabase.auth.verifyOtp({
              token_hash,
              type,
            });
            
            if (error) {
              console.error('Error verifying with token_hash:', error);
              router.replace(`/auth/verification-failed?error_code=${error.code || 'verification_error'}&error_description=${encodeURIComponent(error.message)}`);
              return;
            }
            
            // Redirect to verification success page
            router.replace(`/auth/verification-success?type=${type}`);
          } catch (error) {
            console.error('Exception verifying with token_hash:', error);
            router.replace('/auth/verification-failed');
          }
          return;
        }
        
        if (token && type) {
          console.log('Processing token and type from query params');
          
          // Special handling for magic links
          if (type === 'magiclink' || type === 'recovery') {
            console.log('Processing magic link token');
            try {
              // For magic links, we need to use verifyOtp
              const { data, error } = await supabase.auth.verifyOtp({
                token,
                type: type
              });
              
              if (error) {
                console.error('Error verifying magic link token:', error);
                router.replace(`/auth/verification-failed?error_code=${error.code || 'verification_error'}&error_description=${encodeURIComponent(error.message)}`);
                return;
              }
              
              // Wait briefly for the session to be established
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Check if we have a user now
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              
              if (currentUser) {
                // Successfully authenticated, redirect to dashboard
                console.log('Magic link authentication successful, redirecting to dashboard');
                
                // Use shorter delay for better mobile experience
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    try {
                      router.replace('/dashboard');
                    } catch (routerError) {
                      console.log("Router failed, using window.location");
                      window.location.href = '/dashboard';
                    }
                  }
                }, 300);
              } else {
                // Something went wrong
                console.error('Failed to authenticate with magic link, no user found after verification');
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    try {
                      router.replace('/');
                    } catch (routerError) {
                      console.log("Router failed, using window.location");
                      window.location.href = '/';
                    }
                  }
                }, 300);
              }
              return;
            } catch (error) {
              console.error('Exception processing magic link:', error);
              router.replace('/auth/verification-failed');
              return;
            }
          }
          
          // If not logged in and it's an email change, need to handle differently
          if (!user && type === 'email_change') {
            console.log('User not logged in, redirecting to login first');
            setError('Please log in to complete email verification');
            setTimeout(() => {
              router.replace('/?auth_action=login&verification_pending=true');
            }, 3000);
            return;
          }
          
          // Redirect to verification success page
          router.replace(`/auth/verification-success?type=${type}`);
          return;
        }
        
        // Next, check for hash fragments
        if (typeof window !== 'undefined' && window.location.hash) {
          console.log('Processing hash fragment', window.location.hash);
          
          // If we have hash parameters, extract any 'type' information
          const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
          const hashType = hashParams.get('type');
          
          if (hashType) {
            // If not logged in and it's an email change, need to handle differently
            if (!user && hashType === 'email_change') {
              console.log('User not logged in, redirecting to login first');
              setError('Please log in to complete email verification');
              setTimeout(() => {
                router.replace('/?auth_action=login&verification_pending=true');
              }, 3000);
              return;
            }
            
            // Redirect to verification success page with type
            router.replace(`/auth/verification-success?type=${hashType}`);
            return;
          }
          
          // If we have an access token, it's a general auth success
          if (window.location.hash.includes('access_token')) {
            console.log('Auth with access token, redirecting to dashboard');
            
            // Let the hash be processed by Supabase auth refresh
            setTimeout(() => {
              if (user) {
                // User is now logged in, redirect to the dashboard
                try {
                  router.replace('/dashboard');
                } catch (routerError) {
                  console.log("Router failed, using window.location");
                  window.location.href = '/dashboard';
                }
              } else {
                // Still not logged in, try the home page
                try {
                  router.replace('/');
                } catch (routerError) {
                  console.log("Router failed, using window.location");
                  window.location.href = '/';
                }
              }
            }, 1000); // Reduced from 2000ms to 1000ms for better mobile experience
            return;
          }
        }
        
        // Default fallback
        console.log('No specific auth parameters found, redirecting to dashboard');
        setTimeout(() => {
          const destination = user ? '/dashboard' : '/';
          try {
            router.replace(destination);
          } catch (routerError) {
            console.log("Router failed, using window.location");
            window.location.href = destination;
          }
        }, 500); // Reduced delay for better mobile experience
      } catch (error) {
        console.error('Error handling auth callback:', error);
        setError('An error occurred processing your verification');
        setTimeout(() => {
          router.replace('/auth/verification-failed');
        }, 3000);
      } finally {
        setIsProcessing(false);
      }
    };
    
    // Only run when the router is ready
    if (router.isReady && supabase) {
      handleCallback();
    }
  }, [router, router.isReady, user, supabase]);
  
  if (error) {
    return (
      <StyleWrapper message={`${error}. Redirecting...`} />
    );
  }
  
  return (
    <StyleWrapper message="Processing verification..." />
  );
} 