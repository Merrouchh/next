import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import { AiOutlineCopy, AiOutlineDollar, AiOutlineCreditCard, AiOutlineBank, AiOutlineClose } from 'react-icons/ai';
import styles from './Shop.module.css';

const Shop = () => {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('prices'); // Default tab
  const [conversionRate, setConversionRate] = useState(10); // Default rate
  const [isNormalSectionOpen, setIsNormalSectionOpen] = useState(false);
  const [isVIPSectionOpen, setIsVIPSectionOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Fetch the conversion rate from an API
    const fetchConversionRate = async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        setConversionRate(data.rates.MAD);
      } catch (error) {
        console.error('Error fetching conversion rate:', error);
      }
    };

    fetchConversionRate();
  }, []);

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

  const convertToMAD = (usd) => {
    return (usd * conversionRate).toFixed(2);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'online') {
      setShowPopup(true);
    }
  };

  return (
    <>
      <Header />
      <Head>
        <title>Shop</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <main className={styles.main}>
        <h2 className={styles.heading}>Shop</h2>

        {/* Tab Icons */}
        <div className={styles.tabContainer}>
          <div className={`${styles.tab} ${activeTab === 'prices' ? styles.activeTab : ''}`} onClick={() => handleTabClick('prices')}>
            <AiOutlineDollar size={30} />
            <span>Gaming Prices</span>
          </div>
          <div className={`${styles.tab} ${activeTab === 'online' ? styles.activeTab : ''}`} onClick={() => handleTabClick('online')}>
            <AiOutlineCreditCard size={30} />
            <span>Online Payment</span>
          </div>
          <div className={`${styles.tab} ${activeTab === 'bank' ? styles.activeTab : ''}`} onClick={() => handleTabClick('bank')}>
            <AiOutlineBank size={30} />
            <span>Bank Transfer</span>
          </div>
        </div>

        {showPopup && (
          <div className={styles.popup}>
            <div className={styles.popupContent}>
              <p>
                Paying online includes a small convenience fee ranging from 3.5 DH to 14 DH, depending on the package. The price shown during online payment already includes this fee, while paying by bank transfer or on-site does not include any additional charges.
              </p>
              <p>
                <strong>French:</strong><br />
                Payer en ligne inclut un petit frais de commodité allant de 3,5 DH à 14 DH, selon le forfait. Le prix affiché lors du paiement en ligne inclut déjà ces frais, tandis que le paiement par virement bancaire ou sur place ne comporte aucun frais supplémentaire.
              </p>
              <AiOutlineClose className={styles.closeIcon} onClick={() => setShowPopup(false)} />
            </div>
          </div>
        )}

        {/* Gaming Prices Section */}
        {activeTab === 'prices' && (
  <section className={styles.section}>
    <div className={styles.centeredText}>Prices</div>
    <table className={styles.priceTable}>
      <thead>
        <tr>
          <th>Duration</th>
          <th>Type</th>
          <th>Price (DH)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>30 min</td>
          <td>Normal</td>
          <td>8 DH</td>
        </tr>
        <tr>
          <td>1 hour</td>
          <td>Normal</td>
          <td>15 DH</td>
        </tr>
        <tr>
          <td>4 hour pack</td>
          <td>Normal</td>
          <td>50 DH</td>
        </tr>
        <tr>
          <td>10 hour</td>
          <td>Normal</td>
          <td>115 DH</td>
        </tr>
        <tr>
          <td>20 hour pack</td>
          <td>Normal</td>
          <td>210 DH</td>
        </tr>
        <tr>
          <td>30 min</td>
          <td>VIP</td>
          <td>10 DH</td>
        </tr>
        <tr>
          <td>1 hour</td>
          <td>VIP</td>
          <td>18 DH</td>
        </tr>
        <tr>
          <td>3 hour pack</td>
          <td>VIP</td>
          <td>50 DH</td>
        </tr>
        <tr>
          <td>8 hour pack</td>
          <td>VIP</td>
          <td>105 DH</td>
        </tr>
        <tr>
          <td>20 hour pack</td>
          <td>VIP</td>
          <td>240 DH</td>
        </tr>
      </tbody>
    </table>
    <div className={styles.centeredText}>Cost Per Hour</div>
    <table className={styles.priceTable}>
      <thead>
        <tr>
          <th>Pack</th>
          <th>Type</th>
          <th>Cost Per Hour (DH)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>4 hour pack</td>
          <td>Normal</td>
          <td>12.5 DH</td>
        </tr>
        <tr>
          <td>10 hour pack</td>
          <td>Normal</td>
          <td>11.5 DH</td>
        </tr>
        <tr>
          <td>20 hour pack</td>
          <td>Normal</td>
          <td>10.5 DH</td>
        </tr>
        <tr>
          <td>3 hour pack</td>
          <td>VIP</td>
          <td>16.67 DH</td>
        </tr>
        <tr>
          <td>8 hour pack</td>
          <td>VIP</td>
          <td>13.125 DH</td>
        </tr>
        <tr>
          <td>20 hour pack</td>
          <td>VIP</td>
          <td>12 DH</td>
        </tr>
      </tbody>
    </table>
  </section>
)}

        {/* Online Payment Section */}
        {activeTab === 'online' && (
          <>
            <section className={styles.section}>
              <div className={styles.toggleButton} onClick={toggleNormalSection}>
                <span className={styles.toggleText}>
                  {isNormalSectionOpen ? 'Collapse Normal Time' : 'Expand Normal Time'}
                </span>
                <div className={styles.arrowIcon}>{isNormalSectionOpen ? '▲' : '▼'}</div>
              </div>
              <div className={`${styles.itemsWrapper} ${!isNormalSectionOpen ? styles.hidden : ''}`}>
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
                        <p className={styles.price}>
                          ${item.price} (~{convertToMAD(item.price)} MAD)
                        </p>

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
              <div className={`${styles.itemsWrapper} ${!isVIPSectionOpen ? styles.hidden : ''}`}>
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
                        <p className={styles.price}>
                          ${item.price} (~{convertToMAD(item.price)} MAD)
                        </p>

                        {/* PayPal Buttons */}
                        <div
                          className={styles.itemContainer}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {/* 30 Minutes VIP */}
                          {item.id === 10 && (
                            <a
                              href="https://www.paypal.com/ncp/payment/ALB4UP628BA6A"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <button className={styles.paypalButton}>Buy 30 Minutes VIP</button>
                            </a>
                          )}

                          {/* 1 Hour VIP */}
                          {item.id === 5 && (
                            <a
                              href="https://www.paypal.com/ncp/payment/KYDA92NHSZQUJ"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <button className={styles.paypalButton}>Buy 1 Hour VIP</button>
                            </a>
                          )}

                          {/* 3 Hours VIP */}
                          {item.id === 6 && (
                            <a
                              href="https://www.paypal.com/ncp/payment/SM4B9TU6E8LHQ"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <button className={styles.paypalButton}>Buy 3 Hours VIP</button>
                            </a>
                          )}

                          {/* 8 Hours VIP */}
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
          </>
        )}

        {/* Bank Transfer Section */}
        {activeTab === 'bank' && (
          <section className={styles.section}>
            <div className={styles.bankTransferDetails}>
              <h3 className={styles.bankTransferHeading}>CIH Bank Users</h3>
              <div className={styles.bankTransferItem}>
                <label>Name:</label>
                <div className={styles.inputContainer}>
                  <input type="text" value="MERROUCH MOKHTAR" readOnly />
                  <AiOutlineCopy className={styles.copyIcon} onClick={() => copyToClipboard('MERROUCH MOKHTAR')} />
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>Account Number:</label>
                <div className={styles.inputContainer}>
                  <input type="text" value="4273566211028100" readOnly />
                  <AiOutlineCopy className={styles.copyIcon} onClick={() => copyToClipboard('4273566211028100')} />
                </div>
              </div>
              <div className={styles.divider}></div>
              <h3 className={styles.bankTransferHeading}>Other Bank Users</h3>
              <div className={styles.bankTransferItem}>
                <label>Name:</label>
                <div className={styles.inputContainer}>
                  <input type="text" value="MOKHTAR MERROUCH" readOnly />
                  <AiOutlineCopy className={styles.copyIcon} onClick={() => copyToClipboard('MOKHTAR MERROUCH')} />
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>RIB:</label>
                <div className={styles.inputContainer}>
                  <input type="text" value="230 640 4273566211028100 66" readOnly />
                  <AiOutlineCopy className={styles.copyIcon} onClick={() => copyToClipboard('230 640 4273566211028100 66')} />
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>IBAN:</label>
                <div className={styles.inputContainer}>
                  <input type="text" value="MA64 2306 4042 7356 6211 0281 0066" readOnly />
                  <AiOutlineCopy className={styles.copyIcon} onClick={() => copyToClipboard('MA64 2306 4042 7356 6211 0281 0066')} />
                </div>
              </div>
              <div className={styles.bankTransferItem}>
                <label>Code SWIFT:</label>
                <div className={styles.inputContainer}>
                  <input type="text" value="CIHMMAMC" readOnly />
                  <AiOutlineCopy className={styles.copyIcon} onClick={() => copyToClipboard('CIHMMAMC')} />
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
};

export default Shop;