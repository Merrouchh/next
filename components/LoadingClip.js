import styles from '../styles/LoadingClip.module.css';

const LoadingClip = () => {
  return (
    <div className={styles.loadingClip}>
      <div className={styles.header}>
        <div className={styles.userInfo}></div>
        <div className={styles.gameTag}></div>
      </div>
      <div className={styles.title}></div>
      <div className={styles.videoPlaceholder}>
        <div className={styles.spinner}>
          <span>Loading</span>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.leftStats}></div>
        <div className={styles.rightStats}></div>
      </div>
    </div>
  );
};

export default LoadingClip; 