import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';

// Simple styled component for loading/message display
const StyleWrapper = ({ message }) => {
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

export default function Confirm() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [error, setError] = useState(null);
  
  // Process auth confirmation
  useEffect(() => {
    // Log for debugging
    console.log('Auth Confirm Page Loaded', { 
      query: router.query,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      user: user?.email,
      isLoggedIn: !!user
    });

    const handleConfirm = async () => {
      try {
        const { token_hash, type } = router.query;
        
        if (token_hash && type) {
          console.log('Confirming with token_hash and type:', type);
          
          // If it's an email change and user is not logged in, redirect to login
          if (type === 'email_change' && !user) {
            console.log('Email change requires login first');
            setTimeout(() => {
              router.replace('/?auth_action=login&verification_pending=true');
            }, 2000);
            setError('Please log in to complete email verification');
            return;
          }
          
          // Let Supabase process this automatically
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type,
          });
          
          if (error) {
            console.error('Error verifying OTP:', error);
            router.replace(`/auth/verification-failed?error_code=${error.code || 'verification_error'}&error_description=${encodeURIComponent(error.message)}`);
            return;
          }
          
          // Redirect to success page
          router.replace(`/auth/verification-success?type=${type}`);
          return;
        }
        
        // If we don't have the necessary parameters, redirect to verification failed
        router.replace('/auth/verification-failed');
      } catch (error) {
        console.error('Error handling confirmation:', error);
        router.replace('/auth/verification-failed');
      }
    };
    
    // Only run when the router is ready and we have a supabase client
    if (router.isReady && supabase) {
      handleConfirm();
    }
  }, [router, router.isReady, supabase, user]);
  
  if (error) {
    return <StyleWrapper message={`${error}. Redirecting...`} />;
  }
  
  return <StyleWrapper message="Confirming your email..." />;
} 