import React, { useEffect, useState } from 'react';
import { AiOutlineCopy, AiOutlineDollar, AiOutlineCreditCard, AiOutlineBank, AiOutlineClose } from 'react-icons/ai';
import styles from '../styles/Shop.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Head from 'next/head';

export async function getServerSideProps({ res }) {
  // Cache headers removed

  return {
    props: {
      timestamp: Date.now()
    }
  };
}

const Shop = () => {
  useAuth();
  const router = useRouter();
  const [error] = useState(null);
  const [activeTab, setActiveTab] = useState('prices');
  const [showPopup, setShowPopup] = useState(false);



  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => router.reload()}>
            Retry
          </button>
        </div>
      </ProtectedPageWrapper>
    );
  }



  const copyToClipboard = (text, field, event) => {
    // Add visual feedback to the clicked element
    const addVisualFeedback = (event) => {
      if (!event || !event.currentTarget) {
        console.warn('No event or currentTarget available for visual feedback');
        return;
      }
      
      const container = event.currentTarget;
      if (!container || !container.style) {
        console.warn('Container or container.style not available for visual feedback');
        return;
      }
      
      try {
        container.style.transform = 'scale(0.95)';
        container.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
        
        setTimeout(() => {
          if (container && container.style) {
            container.style.transform = '';
            container.style.backgroundColor = '';
          }
        }, 200);
      } catch (error) {
        console.warn('Error applying visual feedback:', error);
      }
    };

    // Simple fallback copy method
    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        console.error('execCommand copy failed:', err);
        document.body.removeChild(textArea);
        return false;
      }
    };

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          addVisualFeedback(event);
          toast.success(`${field} copied to clipboard!`, {
            position: 'top-right',
            style: {
              background: '#333',
              color: '#fff',
              border: '1px solid #FFD700',
            },
            iconTheme: {
              primary: '#FFD700',
              secondary: '#333',
            },
          });
        })
        .catch(() => {
          // Modern API failed, try fallback
          if (fallbackCopy()) {
            addVisualFeedback(event);
      toast.success(`${field} copied to clipboard!`, {
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #FFD700',
        },
        iconTheme: {
          primary: '#FFD700',
          secondary: '#333',
        },
      });
          } else {
      toast.error('Failed to copy text', {
        position: 'top-right'
      });
          }
        });
    } else {
      // Use fallback for older browsers
      if (fallbackCopy()) {
        addVisualFeedback(event);
        toast.success(`${field} copied to clipboard!`, {
          position: 'top-right',
          style: {
            background: '#333',
            color: '#fff',
            border: '1px solid #FFD700',
          },
          iconTheme: {
            primary: '#FFD700',
            secondary: '#333',
          },
        });
      } else {
        toast.error('Failed to copy text', {
          position: 'top-right'
        });
      }
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <>
      <Head>
        <title>Gaming Shop | Buy Gaming Time & Products | Merrouch Gaming</title>
      </Head>
      <ProtectedPageWrapper>
        <main className={styles.shopMain}>
        <h2 className={styles.heading}>Shop</h2>

        {/* Tab Icons */}
        <div className={styles.tabContainer}>
          <div className={`${styles.tab} ${activeTab === 'prices' ? styles.activeTab : ''}`} onClick={() => handleTabClick('prices')}>
            <AiOutlineDollar size={30} />
            <span>Gaming Prices</span>
          </div>
          <div className={`${styles.tab} ${activeTab === 'bank' ? styles.activeTab : ''}`} onClick={() => handleTabClick('bank')}>
            <AiOutlineBank size={30} />
            <span>Bank Transfer</span>
          </div>
        </div>



        {/* Gaming Prices Section */}
        {activeTab === 'prices' && (
  <section className={styles.section}>
    <div className={styles.centeredText}>Gaming Prices</div>
    <table className={styles.priceTable}>
      <thead>
        <tr>
          <th>Duration</th>
          <th>Cost Per Hour</th>
          <th>Total Price</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td data-label="Duration">30 Min</td>
          <td data-label="Cost Per Hour">-</td>
          <td data-label="Total Price">10 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">1 Hour</td>
          <td data-label="Cost Per Hour">-</td>
          <td data-label="Total Price">18 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">3 Hours</td>
          <td data-label="Cost Per Hour">16.67 Dh</td>
          <td data-label="Total Price">50 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">7 Hours</td>
          <td data-label="Cost Per Hour">14.29 Dh</td>
          <td data-label="Total Price">100 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">15 Hours</td>
          <td data-label="Cost Per Hour">13.33 Dh</td>
          <td data-label="Total Price">200 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">24 Hours</td>
          <td data-label="Cost Per Hour">12.50 Dh</td>
          <td data-label="Total Price">300 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">36 Hours</td>
          <td data-label="Cost Per Hour">11.11 Dh</td>
          <td data-label="Total Price">400 Dh</td>
        </tr>
        <tr>
          <td data-label="Duration">All DAY (24h)</td>
          <td data-label="Cost Per Hour">-</td>
          <td data-label="Total Price">110 Dh</td>
        </tr>
      </tbody>
    </table>
  </section>
)}

  {/* Events/Tournament Pricing Notice */}
  {activeTab === 'prices' && (
    <section className={styles.section}>
      <div className={styles.centeredText} style={{ marginTop: '2rem', color: '#FF4655' }}>Events / Tournament Pricing</div>
      <table className={styles.priceTable}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Price</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="Type">Event/Tournament</td>
            <td data-label="Price">20 Dh / hour</td>
            <td data-label="Note">Normal time cannot be used</td>
          </tr>
        </tbody>
      </table>
    </section>
  )}


        {/* Bank Transfer Section */}
        {activeTab === 'bank' && (
          <section className={styles.section}>
            <div className={styles.bankTransferDetails}>
              <h3 className={styles.bankTransferHeading}>CIH Bank Users</h3>
              <div className={styles.bankTransferItem}>
                <label>Name:</label>
                <div 
                  className={styles.inputContainer}
                  onClick={(e) => copyToClipboard('MERROUCH MOKHTAR', 'Name', e)}
                  title="Click to copy"
                >
                  <input type="text" value="MERROUCH MOKHTAR" readOnly />
                  <div className={styles.copyIcon}>
                    <AiOutlineCopy size={20} />
                  </div>
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>Account Number:</label>
                <div 
                  className={styles.inputContainer}
                  onClick={(e) => copyToClipboard('4273566211028100', 'Account Number', e)}
                  title="Click to copy"
                >
                  <input type="text" value="4273566211028100" readOnly />
                  <div className={styles.copyIcon}>
                    <AiOutlineCopy size={20} />
                  </div>
                </div>
              </div>
              <div className={styles.divider}></div>
              <h3 className={styles.bankTransferHeading}>Other Bank Users</h3>
              <div className={styles.bankTransferItem}>
                <label>Name:</label>
                <div 
                  className={styles.inputContainer}
                  onClick={(e) => copyToClipboard('MOKHTAR MERROUCH', 'Name', e)}
                  title="Click to copy"
                >
                  <input type="text" value="MOKHTAR MERROUCH" readOnly />
                  <div className={styles.copyIcon}>
                    <AiOutlineCopy size={20} />
                  </div>
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>RIB:</label>
                <div 
                  className={styles.inputContainer}
                  onClick={(e) => copyToClipboard('230 640 4273566211028100 66', 'RIB', e)}
                  title="Click to copy"
                >
                  <input type="text" value="230 640 4273566211028100 66" readOnly />
                  <div className={styles.copyIcon}>
                    <AiOutlineCopy size={20} />
                  </div>
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>IBAN:</label>
                <div 
                  className={styles.inputContainer}
                  onClick={(e) => copyToClipboard('MA64 2306 4042 7356 6211 0281 0066', 'IBAN', e)}
                  title="Click to copy"
                >
                  <input type="text" value="MA64 2306 4042 7356 6211 0281 0066" readOnly />
                  <div className={styles.copyIcon}>
                    <AiOutlineCopy size={20} />
                  </div>
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>Code SWIFT:</label>
                <div 
                  className={styles.inputContainer}
                  onClick={(e) => copyToClipboard('CIHMMAMC', 'Code SWIFT', e)}
                  title="Click to copy"
                >
                  <input type="text" value="CIHMMAMC" readOnly />
                  <div className={styles.copyIcon}>
                    <AiOutlineCopy size={20} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </ProtectedPageWrapper>
    </>
  );
};

export default Shop;