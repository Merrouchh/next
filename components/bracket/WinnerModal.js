import styles from '../../styles/Bracket.module.css';

const WinnerModal = ({ match, participants, onClose, onSetWinner }) => {
  const participant1 = participants.find(p => p.id === match.participant1Id);
  const participant2 = participants.find(p => p.id === match.participant2Id);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Select Winner</h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <p>Select the winner of this match:</p>
          <div className={styles.winnerOptions}>
            <button 
              className={styles.winnerOption}
              onClick={() => onSetWinner(match.participant1Id)}
            >
              {participant1 ? participant1.name : match.participant1Name}
            </button>
            <button 
              className={styles.winnerOption}
              onClick={() => onSetWinner(match.participant2Id)}
            >
              {participant2 ? participant2.name : match.participant2Name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinnerModal; 