import Head from 'next/head';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/VoiceChat.module.css';
import { useEffect, useRef } from 'react';

export default function VoiceChatPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const adjustIframeHeight = () => {
      if (iframeRef.current) {
        const iframeDocument = iframeRef.current.contentDocument;
        
        if (iframeDocument) {
          // Adjust iframe height based on content height
          iframeRef.current.style.height = iframeDocument.body.scrollHeight + 'px';

          // Automatically scroll the parent window when the iframe grows
          window.scrollTo(0, document.body.scrollHeight);
        }
      }
    };

    // MutationObserver to track changes inside the iframe's content
    const iframeDocument = iframeRef.current?.contentDocument;

    if (iframeDocument) {
      const observer = new MutationObserver(adjustIframeHeight);
      observer.observe(iframeDocument.body, {
        childList: true,
        subtree: true,
      });

      // Initial adjustment of iframe height
      adjustIframeHeight();

      // Clean up observer on component unmount
      return () => {
        observer.disconnect();
      };
    }

    // Fallback to adjusting height when the iframe is reloaded or resized
    window.addEventListener('resize', adjustIframeHeight);

    // Cleanup resize event listener
    return () => {
      window.removeEventListener('resize', adjustIframeHeight);
    };
  }, []);

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Voice Chat - Merrouch Gaming</title>
      </Head>
      
      <div className={styles.container}>
        <iframe
          ref={iframeRef}
          src="/api/voicechat"
          className={styles.frame}
          allow="microphone; autoplay"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </ProtectedPageWrapper>
  );
}
