import React from 'react';
import { AiOutlineDashboard } from 'react-icons/ai';
import { FaUsers } from 'react-icons/fa';
import styles from '../../styles/Dashboard.module.css';

const AdminStaffSection = ({ user, authLoading, initialized, router }) => {
  // More explicit role checking with debugging
  const isAdmin = user?.isAdmin === true;
  const isStaff = user?.isStaff === true;
  
  // Debug logging to help identify issues
  console.log('AdminStaffSection - User roles:', { 
    username: user?.username, 
    isAdmin, 
    isStaff, 
    authLoading, 
    initialized 
  });
  
  // Early returns for invalid states
  if (authLoading || !initialized || !user) {
    return null;
  }
  
  // Must have at least one role
  if (!isAdmin && !isStaff) {
    return null;
  }
  
  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHeader}>
        <h2>
          {isAdmin && isStaff ? 'Admin & Staff Controls' : 
           isAdmin ? 'Admin Controls' : 'Staff Controls'}
        </h2>
        <p>
          Welcome to the {isAdmin && isStaff ? 'admin and staff' : 
                         isAdmin ? 'admin' : 'staff'} dashboard. 
          You have access to additional controls and features.
        </p>
      </div>
      <div className={styles.adminMainAction}>
        {/* Show Admin button if user is admin */}
        {isAdmin && (
          <button 
            className={styles.adminDashboardButton}
            onClick={() => router.push('/admin')}
            style={{ marginRight: isStaff ? '10px' : '0' }}
          >
            <AiOutlineDashboard className={styles.adminDashboardIcon} />
            Open Admin Dashboard
          </button>
        )}
        
        {/* Show Staff button if user is staff */}
        {isStaff && (
          <button 
            className={styles.adminDashboardButton}
            onClick={() => router.push('/admin/queue')}
          >
            <FaUsers className={styles.adminDashboardIcon} />
            Manage Queue System
          </button>
        )}
      </div>
    </section>
  );
};

export default AdminStaffSection; 