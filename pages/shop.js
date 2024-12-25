import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import styles from './Shop.module.css';

const Shop = () => {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isNormalSectionOpen, setIsNormalSectionOpen] = useState(false); // Start collapsed
  const [isVIPSectionOpen, setIsVIPSectionOpen] = useState(false); // Start collapsed

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  const parseDuration = (name) => {
    const regex = /(\d+)\s*(minute|hour)/i;
    const match = name.match(regex);
    if (match) {
      const number = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'hour') {
        return number * 60;
      }
      return number;
    }
    return 0;
  };

  useEffect(() => {
    const shopItems = [
      { id: 1, name: '1 Hour Normal', price: 1.88, type: 'Normal' },
      { id: 2, name: '4 Hours Normal', price: 5.54, type: 'Normal' },
      { id: 3, name: '10 Hours Normal', price: 12.34, type: 'Normal' },
      { id: 4, name: '20 Hours Normal', price: 22.28, type: 'Normal' },
      { id: 5, name: '1 Hour VIP', price: 2.20, type: 'VIP' },
      { id: 6, name: '3 Hours VIP', price: 5.54, type: 'VIP' },
      { id: 7, name: '8 Hours VIP', price: 11.30, type: 'VIP' },
      { id: 8, name: '20 Hours VIP', price: 25.42, type: 'VIP' },
      { id: 9, name: '30 Minutes Normal', price: 1.15, type: 'Normal' },
      { id: 10, name: '30 Minutes VIP', price: 1.36, type: 'VIP' },
    ];

    const sortedItems = shopItems.sort((a, b) => parseDuration(a.name) - parseDuration(b.name));
    setItems(sortedItems);
  }, []);

  const handleProductClick = (item) => {
    setSelectedItem(item);
  };

  const toggleNormalSection = () => {
    setIsNormalSectionOpen(!isNormalSectionOpen);
  };

  const toggleVIPSection = () => {
    setIsVIPSectionOpen(!isVIPSectionOpen);
  };

  if (!isLoggedIn) return null;

  return (
    <>
      <Header />
      <Head>
        <title>Shop</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.main}>
        <h2 className={styles.heading}>Shop</h2>

        {/* Normal Section */}
        <section className={styles.section}>
          <div className={styles.toggleButton} onClick={toggleNormalSection}>
            <span className={styles.toggleText}>
              {isNormalSectionOpen ? 'Collapse Normal Time' : 'Expand Normal Time'}
            </span>
            <div className={styles.arrowIcon}>{isNormalSectionOpen ? '▲' : '▼'}</div>
          </div>
          <div
            className={`${styles.itemsWrapper} ${!isNormalSectionOpen ? styles.hidden : ''}`}
          >
            {isNormalSectionOpen &&
              items
                .filter((item) => item.type === 'Normal')
                .map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.item} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                    onClick={() => handleProductClick(item)}
                  >
                    <h4 className={styles.itemName}>{item.name}</h4>
                    <p className={styles.price}>${item.price}</p>

                    {/* PayPal Buttons */}
                    <div
                      className={styles.itemContainer}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {/* 30 Minutes Normal */}
                      {item.id === 9 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/VYFYB4Y69XMMQ"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 30 Minutes Normal</button>
                        </a>
                      )}

                      {/* 1 Hour Normal */}
                      {item.id === 1 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/59WE2S83CWGMN"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 1 Hour Normal</button>
                        </a>
                      )}

                      {/* 4 Hours Normal */}
                      {item.id === 2 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/RTQ2XKPDN3KUE"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 4 Hours Normal</button>
                        </a>
                      )}

                      {/* 10 Hours Normal */}
                      {item.id === 3 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/B3JAJD2BB675Q"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 10 Hours Normal</button>
                        </a>
                      )}

                      {/* 20 Hours Normal */}
                      {item.id === 4 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/ZXWT9M8HDXUEW"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 20 Hours Normal</button>
                        </a>
                      )}
                    </div>

                    {selectedItem?.id === item.id && <div id={`paypal-container-${item.id}`}></div>}
                  </div>
                ))}
          </div>
        </section>

        {/* VIP Section */}
        <section className={styles.section}>
          <div className={styles.toggleButton} onClick={toggleVIPSection}>
            <span className={styles.toggleText}>
              {isVIPSectionOpen ? 'Collapse VIP Time' : 'Expand VIP Time'}
            </span>
            <div className={styles.arrowIcon}>{isVIPSectionOpen ? '▲' : '▼'}</div>
          </div>
          <div
            className={`${styles.itemsWrapper} ${!isVIPSectionOpen ? styles.hidden : ''}`}
          >
            {isVIPSectionOpen &&
              items
                .filter((item) => item.type === 'VIP')
                .map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.item} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                    onClick={() => handleProductClick(item)}
                  >
                    <h4 className={styles.itemName}>
                      {item.name}
                      <span className={styles.crownIcon}>👑</span>
                    </h4>
                    <p className={styles.price}>${item.price}</p>

                    {/* PayPal Buttons */}
                    <div
                      className={styles.itemContainer}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {/* 4 Hours VIP */}
                      {item.id === 10 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/ALB4UP628BA6A"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 30 Minutes VIP</button>
                        </a>
                      )}

                      {/* 10 Hours VIP */}
                      {item.id === 5 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/KYDA92NHSZQUJ"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 1 Hour VIP</button>
                        </a>
                      )}

                      {item.id === 6 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/SM4B9TU6E8LHQ"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 3 Hours VIP</button>
                        </a>
                      )}

                      {item.id === 7 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/EWFB8ZTNH7YCA"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 8 Hours VIP</button>
                        </a>
                      )}

                      {/* 20 Hours VIP */}
                      {item.id === 8 && (
                        <a
                          href="https://www.paypal.com/ncp/payment/WWP3BU982L6SW"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button className={styles.paypalButton}>Buy 20 Hours VIP</button>
                        </a>
                      )}
                    </div>

                    {selectedItem?.id === item.id && <div id={`paypal-container-${item.id}`}></div>}
                  </div>
                ))}
          </div>
        </section>
      </main>
    </>
  );
};

export default Shop;
