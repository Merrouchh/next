import React from 'react';
import styles from '../styles/DesktopTeamModal.module.css';

export default function DesktopTeamModal({
  filteredTeamMembers,
  selectedTeamMembers,
  searchQuery,
  onSearchChange,
  handleTeamMemberSelection,
  completeRegistration,
  teamType,
  closeModal,
  teamName,
  onTeamNameChange,
  notes,
  onNotesChange,
  registrationStatus,
  eventTitle,
}) {
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

  // Determine if registration can be completed
  const canRegister = 
    !registrationStatus.isLoading &&
    selectedTeamMembers.length > 0 &&
    (teamType === 'duo' || (teamType === 'team' && teamName.trim()));

  return (
    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.modalHeader}>
        <h3>{teamType === 'duo' ? 'Select Your Partner' : 'Select Your Team'}</h3>
        <button className={styles.closeButton} onClick={closeModal}>×</button>
      </div>
      <div className={styles.modalBody}>
        <div className={styles.modalSection}>
          <h4 className={styles.sectionTitle}>1. Select {teamType === 'duo' ? 'Partner' : 'Team Members'}</h4>
          
          {/* Search */}
          <div className={styles.searchContainer}>
            <input
              type="text"
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search for teammates..."
              className={styles.searchInput}
            />
          </div>
          
          {/* Team members list */}
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
        </div>

        {/* Selected members */}
        <div className={styles.modalSection}>
          <h4 className={styles.sectionTitle}>2. Selected {teamType === 'duo' ? 'Partner' : 'Team Members'}</h4>
          
          {selectedTeamMembers.length > 0 ? (
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
          ) : (
            <div className={styles.emptySelection}>
              No {teamType === 'duo' ? 'partner' : 'team members'} selected yet
            </div>
          )}
        </div>
        
        {/* Team name input */}
        <div className={styles.modalSection}>
          <h4 className={styles.sectionTitle}>3. Team Details</h4>
          
          <div className={styles.teamNameInput}>
            <label htmlFor="teamName">Team Name{teamType === 'duo' ? ' (Optional)' : ''}:</label>
            <input
              type="text"
              id="teamName"
              value={teamName}
              onChange={e => onTeamNameChange(e.target.value)}
              placeholder={teamType === 'duo' ? 'Enter team name (or use auto-generated)' : 'Enter your team name'}
              maxLength={30}
              required={teamType === 'team'}
              className={`${styles.input} ${teamType !== 'duo' && !teamName.trim() ? styles.inputError : ''}`}
            />
            {teamType !== 'duo' && !teamName.trim() && selectedTeamMembers.length > 0 && (
              <div className={styles.inputErrorText}>Team name is required</div>
            )}
            <small>
              {teamType === 'duo'
                ? "Optional: We'll auto-generate a name from both usernames if left empty"
                : "This name will appear in the tournament bracket"}
            </small>
          </div>
          
          {/* Notes input */}
          <div className={styles.notesContainer}>
            <label htmlFor="registrationNotes">Notes (optional):</label>
            <textarea
              id="registrationNotes"
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
              placeholder="Any additional information..."
              className={styles.notesInput}
              maxLength={500}
            />
          </div>
        </div>
      </div>
      
      <div className={styles.modalActions}>
        <button
          className={`${styles.registerButton} ${!canRegister ? styles.disabled : ''}`}
          onClick={completeRegistration}
          disabled={!canRegister}
        >
          {registrationStatus.isLoading ? 'Processing...' : 'Complete Registration'}
        </button>
        
        {!canRegister && selectedTeamMembers.length === 0 && (
          <div className={styles.validationMessage}>
            Please select at least one {teamType === 'duo' ? 'partner' : 'team member'}
          </div>
        )}
        
        {!canRegister && selectedTeamMembers.length > 0 && teamType !== 'duo' && !teamName.trim() && (
          <div className={styles.validationMessage}>
            Please enter a team name
          </div>
        )}
      </div>
    </div>
  );
} 