import { useEffect } from 'react'
import NextErrorComponent from 'next/error'

// This custom error component will handle specific errors differently
function CustomError({ statusCode, err }) {
  // Check if the error is related to verification code
  const isVerificationError = err?.message?.includes('verification code');

  useEffect(() => {
    // If it's a verification error in development mode, prevent error overlay
    if (isVerificationError && process.env.NODE_ENV !== 'production') {
      console.log('Suppressing verification code error overlay');
      
      if (typeof window !== 'undefined') {
        // Attempt to close any error overlays
        const errorOverlay = document.querySelector('nextjs-portal');
        if (errorOverlay) {
          errorOverlay.remove();
        }
      }
    }
  }, [isVerificationError]);

  // For verification code errors, return null (don't display any error)
  if (isVerificationError) {
    return null;
  }

  // For all other errors, use the default Next.js error component
  return <NextErrorComponent statusCode={statusCode} />
}

CustomError.getInitialProps = async (context) => {
  const errorInitialProps = await NextErrorComponent.getInitialProps(context)
  const { res, err } = context

  // Workaround for https://github.com/vercel/next.js/issues/8592
  errorInitialProps.hasGetInitialPropsRun = true

  // Running on the server, the response object is available.
  if (res?.statusCode === 404) {
    return { statusCode: 404 }
  }

  // Skip creating the error page for verification errors
  if (err?.message?.includes('verification code')) {
    return { 
      statusCode: 200,
      err
    }
  }

  // Handle regular errors
  return errorInitialProps
}

export default CustomError 