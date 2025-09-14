import React, { useState, useEffect } from 'react';
import styles from '../styles/CookieConsent.module.css';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      essential: true,
      analytics: true,
      preferences: true,
      marketing: true,
      timestamp: Date.now()
    }));
    setShowBanner(false);
  };

  const handleAcceptSelected = () => {
    const selectedCookies = {
      essential: true, // Always true
      analytics: document.getElementById('analytics').checked,
      preferences: document.getElementById('preferences').checked,
      marketing: document.getElementById('marketing').checked,
      timestamp: Date.now()
    };
    
    localStorage.setItem('cookieConsent', JSON.stringify(selectedCookies));
    setShowBanner(false);
  };

  const handleDeclineAll = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      essential: true, // Always true
      analytics: false,
      preferences: false,
      marketing: false,
      timestamp: Date.now()
    }));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className={styles.cookieBanner}>
      <div className={styles.cookieContent}>
        <div className={styles.cookieHeader}>
          <h3>🍪 Cookie Preferences</h3>
          <p>
            We use cookies to enhance your gaming experience, analyze site usage, 
            and personalize content. Choose your preferences below.
          </p>
        </div>

        {!showDetails ? (
          <div className={styles.cookieActions}>
            <button 
              className={styles.acceptAllBtn}
              onClick={handleAcceptAll}
            >
              Accept All
            </button>
            <button 
              className={styles.customizeBtn}
              onClick={() => setShowDetails(true)}
            >
              Customize
            </button>
            <button 
              className={styles.declineBtn}
              onClick={handleDeclineAll}
            >
              Decline All
            </button>
          </div>
        ) : (
          <div className={styles.cookieDetails}>
            <div className={styles.cookieOption}>
              <label className={styles.cookieLabel}>
                <input 
                  type="checkbox" 
                  id="essential" 
                  checked 
                  disabled 
                  className={styles.cookieCheckbox}
                />
                <span className={styles.checkmark}></span>
                <div className={styles.cookieInfo}>
                  <strong>Essential Cookies</strong>
                  <small>Required for basic website functionality (login, security)</small>
                </div>
              </label>
            </div>

            <div className={styles.cookieOption}>
              <label className={styles.cookieLabel}>
                <input 
                  type="checkbox" 
                  id="analytics" 
                  defaultChecked
                  className={styles.cookieCheckbox}
                />
                <span className={styles.checkmark}></span>
                <div className={styles.cookieInfo}>
                  <strong>Analytics Cookies</strong>
                  <small>Help us understand how you use our site (anonymous data)</small>
                </div>
              </label>
            </div>

            <div className={styles.cookieOption}>
              <label className={styles.cookieLabel}>
                <input 
                  type="checkbox" 
                  id="preferences" 
                  defaultChecked
                  className={styles.cookieCheckbox}
                />
                <span className={styles.checkmark}></span>
                <div className={styles.cookieInfo}>
                  <strong>Preference Cookies</strong>
                  <small>Remember your settings (theme, language, game preferences)</small>
                </div>
              </label>
            </div>

            <div className={styles.cookieOption}>
              <label className={styles.cookieLabel}>
                <input 
                  type="checkbox" 
                  id="marketing" 
                  defaultChecked
                  className={styles.cookieCheckbox}
                />
                <span className={styles.checkmark}></span>
                <div className={styles.cookieInfo}>
                  <strong>Marketing Cookies</strong>
                  <small>Show relevant gaming content and promotions</small>
                </div>
              </label>
            </div>

            <div className={styles.detailActions}>
              <button 
                className={styles.backBtn}
                onClick={() => setShowDetails(false)}
              >
                Back
              </button>
              <button 
                className={styles.saveBtn}
                onClick={handleAcceptSelected}
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieConsent;
