import React from 'react';
import { FaBell } from 'react-icons/fa';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';

const DebtCard = React.memo(({ debtAmount, hasTime }) => {
  // If no debt or debt is 0, don't render the card
  if (!debtAmount || debtAmount <= 0) {
    return null;
  }

  // Calculate recommended payment based on debt amount
  const getRecommendedPayment = (amount) => {
    if (amount <= 20) {
      return { 
        text: 'Full amount payment required',
        amount: amount,
        percent: 100
      };
    } else {
      // For all other debts, only require 20%
      const payment = Math.ceil(amount * 0.2); // 20%
      return { 
        text: 'At least 20% payment required',
        amount: payment,
        percent: 20
      };
    }
  };

  const recommendation = getRecommendedPayment(debtAmount);

  return (
    <DashboardCard 
      title="Debt Payment Required"
      icon={<FaBell size={24} />}
      className={`${styles.mediumCard} ${styles.debtCard}`}
    >
      <div className={styles.debtCardContent}>
        <div className={styles.debtAmount}>
          <span className={styles.debtLabel}>Current Debt:</span>
          <span className={styles.debtValue}>{debtAmount} DH</span>
        </div>
        <div className={styles.paymentRecommendation}>
          <div className={styles.recommendationText}>
            {recommendation.text}
          </div>
          <div className={styles.recommendedAmount}>
            <span className={styles.minPaymentLabel}>Minimum Payment:</span>
            <span className={styles.minPaymentValue}>{recommendation.amount} DH</span>
            <span className={styles.percentBadge}>{recommendation.percent}%</span>
          </div>
        </div>
        <div className={styles.debtWarning}>
          {!hasTime && <strong> If you have no time remaining, you must pay your debt to continue gaming.</strong>}
          <div className={styles.debtPolicy}>
            <strong>No more debt can be accumulated until your current debt is fully paid.</strong>
          </div>
          <div className={styles.debtRules}>
            <div className={styles.debtRuleItem}>
              <strong>Debt Rules:</strong>
            </div>
            <div className={styles.debtRuleItem}>
              - Only one 50 DH pack OR one single hour can be taken as debt at a time.
            </div>
            <div className={styles.debtRuleItem}>
              - Snacks and drinks cannot be purchased on debt
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
});

DebtCard.displayName = 'DebtCard';

export default DebtCard; 