import React from 'react';
import styles from '../styles/MobileTeamModal.module.css';
import { createPortal } from 'react-dom';

export default function MobileTeamModal({
  filteredTeamMembers,
  selectedTeamMembers,
  searchQuery,
  onSearchChange,
  handleTeamMemberSelection,
  modalStep,
  goToNextStep,
  goToPrevStep,
  completeRegistration,
  teamType,
  closeModal,
  teamName,
  onTeamNameChange,
  notes,
  onNotesChange,
}) {
  // Check if user can proceed to next step
  const canProceedToNextStep = () => {
    if (modalStep === 1) {
      return selectedTeamMembers.length > 0;
    } else if (modalStep === 2) {
      // For team mode, require team name
      // For duo mode, team name is optional (as indicated in the UI)
      return teamType === 'duo' || (teamName && teamName.trim().length > 0);
    }
    return true;
  };

  // Function to handle team member selection with input reset
  const handleSelection = (member) => {
    // Reset search input immediately when selecting a user
    if (!selectedTeamMembers.some(m => m.userId === member.id)) {
      onSearchChange({ target: { value: '' } });
    }
    
    // Call the original handler
    handleTeamMemberSelection(member);
  };

  // Filter out already selected members from the display list
  const availableTeamMembers = filteredTeamMembers.filter(member => 
    !selectedTeamMembers.some(selected => selected.userId === member.id)
  );
  
  // Modal content
  const modalContent = (
    <div className={styles.modalOverlay} onClick={closeModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{teamType === 'duo' ? 'Select Your Partner' : 'Select Your Team'}</h3>
          <button className={styles.closeButton} onClick={closeModal}>×</button>
        </div>

        <div className={styles.stepIndicator}>
          <div className={`${styles.stepDot} ${modalStep === 1 ? styles.active : ''} ${modalStep > 1 ? styles.completed : ''}`} />
          <div className={`${styles.stepDot} ${modalStep === 2 ? styles.active : ''} ${modalStep > 2 ? styles.completed : ''}`} />
          <div className={`${styles.stepDot} ${modalStep === 3 ? styles.active : ''}`} />
        </div>

        <div className={styles.modalBody}>
          {/* Step 1 */}
          <div className={`${styles.modalStep} ${modalStep === 1 ? styles.active : ''} ${selectedTeamMembers.length > 0 ? styles.split : ''}`} data-step="1">
            <div className={styles.selectionSection}>
              <div className={styles.searchContainer}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={onSearchChange}
                  placeholder="Search for teammates..."
                  className={styles.searchInput}
                />
              </div>
              {availableTeamMembers.length === 0 ? (
                <div className={styles.noResults}>
                  {searchQuery 
                    ? 'No teammates found matching your search'
                    : selectedTeamMembers.length > 0 && filteredTeamMembers.length === selectedTeamMembers.length
                    ? 'All available teammates selected'
                    : 'No teammates available'}
                </div>
              ) : (
                <div className={styles.teamMembersList}>
                  {availableTeamMembers.map(member => (
                    <div
                      key={member.id}
                      className={styles.teamMember}
                      onClick={() => handleSelection(member)}
                    >
                      <div className={styles.memberAvatar}>
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.memberName}>{member.username}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {modalStep === 1 && selectedTeamMembers.length === 0 && (
                <div className={styles.selectionRequired}>
                  <p>Please select {teamType === 'duo' ? 'a partner' : 'at least one team member'} to continue</p>
                </div>
              )}
            </div>
            
            {selectedTeamMembers.length > 0 && (
              <div className={styles.selectedSection}>
                <h3>Selected {teamType === 'duo' ? 'Partner' : 'Team Members'}</h3>
                <div className={styles.selectedMembers}>
                  <div className={styles.selectedList}>
                    {selectedTeamMembers.map(member => (
                      <div key={member.userId} className={styles.selectedMember}>
                        <span>{member.username}</span>
                        <button
                          className={styles.removeMember}
                          onClick={() => handleTeamMemberSelection({ id: member.userId, username: member.username })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className={`${styles.modalStep} ${modalStep === 2 ? styles.active : ''}`} data-step="2">
            <div className={styles.teamNameInput}>
              <label htmlFor="teamName">Team Name{teamType === 'duo' ? ' (Optional)' : ''}</label>
              <input
                id="teamName"
                type="text"
                value={teamName}
                onChange={e => onTeamNameChange(e.target.value)}
                placeholder={teamType === 'duo' ? 'Enter team name (or use auto-generated)' : 'Enter your team name'}
                className={styles.searchInput}
              />
              {teamType !== 'duo' && teamName.trim().length === 0 && (
                <div className={styles.nameRequired}>
                  Team name is required
                </div>
              )}
            </div>
            
            {modalStep === 2 && teamType !== 'duo' && !teamName.trim() && (
              <div className={styles.selectionRequired}>
                <p>Please enter a team name to continue</p>
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className={`${styles.modalStep} ${modalStep === 3 ? styles.active : ''}`} data-step="3">
            <div className={styles.summarySection}>
              <h3>Registration Summary</h3>
              <div className={styles.summaryContent}>
                <div className={styles.summaryItem}>
                  <h4>Selected {teamType === 'duo' ? 'Partner' : 'Team Members'}</h4>
                  <div className={styles.summaryMembers}>
                    {selectedTeamMembers.map(member => (
                      <div key={member.userId} className={styles.summaryMember}>
                        <div className={styles.memberAvatar}>
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.memberName}>
                          {member.username}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={styles.summaryItem}>
                  <h4>Team Name</h4>
                  <div className={styles.summaryValue}>
                    {teamName ? teamName : <span className={styles.autoGenerated}>{teamType === 'duo' ? '(Auto-generated)' : 'Untitled Team'}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.notesContainer}>
              <label htmlFor="notes">Notes (optional):</label>
              <textarea
                id="notes"
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                className={styles.notesInput}
                placeholder="Any additional information..."
              />
            </div>
          </div>
        </div>

        <div className={styles.stepButtons}>
          <button
            className={styles.stepButton}
            onClick={goToPrevStep}
            disabled={modalStep === 1}
          >
            Back
          </button>
          {modalStep < 3 ? (
            <button
              className={`${styles.stepButton} ${styles.primary} ${!canProceedToNextStep() ? styles.disabled : ''}`}
              onClick={goToNextStep}
              disabled={!canProceedToNextStep()}
            >
              Next
            </button>
          ) : (
            <button
              className={`${styles.stepButton} ${styles.primary}`}
              onClick={completeRegistration}
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
  
  // Use createPortal to render the modal at the document body level
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body) 
    : null;
} 