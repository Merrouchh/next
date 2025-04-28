import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';

// Simple loading/message component to replace LoadingScreen
const StyleWrapper = ({ message, type }) => {
  return (
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
      gap: '1rem'
    }}>
      <div>{message || "Processing, please wait..."}</div>
    </div>
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
                router.replace('/dashboard');
              } else {
                // Something went wrong
                console.error('Failed to authenticate with magic link, no user found after verification');
                router.replace('/');
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
                router.replace('/dashboard');
              } else {
                // Still not logged in, try the home page
                router.replace('/');
              }
            }, 2000);
            return;
          }
        }
        
        // Default fallback
        console.log('No specific auth parameters found, redirecting to dashboard');
        setTimeout(() => {
          router.replace(user ? '/dashboard' : '/');
        }, 1000);
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