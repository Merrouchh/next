/**
 * Centralized utility for handling participant names and display formatting
 * This ensures consistent name display across all components (bracket, participants list, admin)
 */

/**
 * Get the display name for a participant based on event type and available data
 * @param {Object} participant - The participant object
 * @param {string} eventType - The event type ('solo', 'duo', 'team')
 * @param {Object} options - Display options
 * @returns {string|Object} - Formatted name or JSX element
 */
export function getParticipantDisplayName(participant, eventType, options = {}) {
  const {
    format = 'text', // 'text' or 'jsx'
    showTeamName = true,
    showPartnerNames = true,
    separator = ' & ',
    className = '',
    styles = {}
  } = options;

  if (!participant) {
    return format === 'jsx' ? <span>TBD</span> : 'TBD';
  }

  // Normalize participant data - handle different field names
  const normalizedParticipant = {
    id: participant.id,
    name: participant.name || participant.username,
    userId: participant.userId || participant.user_id,
    teamName: participant.team_name || participant.teamName,
    members: participant.members || [],
    partner: participant.partner
  };

  // Solo events - just show the name
  if (eventType === 'solo') {
    const displayName = normalizedParticipant.name || 'Unknown';
    return format === 'jsx' ? <span className={className}>{displayName}</span> : displayName;
  }

  // Team events - prioritize team name, fallback to captain name
  if (eventType === 'team') {
    if (showTeamName && normalizedParticipant.teamName) {
      const teamName = normalizedParticipant.teamName;
      return format === 'jsx' ? 
        <span className={`${className} ${styles.teamName || ''}`}>{teamName}</span> : 
        teamName;
    }
    
    // Fallback to captain name if no team name
    const captainName = normalizedParticipant.name || 'Unknown Team';
    return format === 'jsx' ? <span className={className}>{captainName}</span> : captainName;
  }

  // Duo events - handle team name vs individual names
  if (eventType === 'duo') {
    // If there's a team name and we should show it, use that
    if (showTeamName && normalizedParticipant.teamName) {
      const teamName = normalizedParticipant.teamName;
      return format === 'jsx' ? 
        <span className={`${className} ${styles.teamName || ''}`}>{teamName}</span> : 
        teamName;
    }

    // Otherwise show individual names
    if (showPartnerNames) {
      const mainName = normalizedParticipant.name || 'Unknown';
      
      // Get partner name from members array or partner field
      let partnerName = null;
      if (normalizedParticipant.members && normalizedParticipant.members.length > 0) {
        partnerName = normalizedParticipant.members[0].name || normalizedParticipant.members[0].username;
      } else if (normalizedParticipant.partner) {
        partnerName = normalizedParticipant.partner;
      }

      if (partnerName) {
        const fullName = `${mainName}${separator}${partnerName}`;
        return format === 'jsx' ? 
          <div className={`${className} ${styles.duoNames || ''}`}>
            <span>{mainName}</span>
            <span className={styles.separator || ''}>{separator}</span>
            <span>{partnerName}</span>
          </div> : 
          fullName;
      }
    }

    // Fallback to main name only
    const mainName = normalizedParticipant.name || 'Unknown';
    return format === 'jsx' ? <span className={className}>{mainName}</span> : mainName;
  }

  // Default fallback
  const fallbackName = normalizedParticipant.name || 'Unknown';
  return format === 'jsx' ? <span className={className}>{fallbackName}</span> : fallbackName;
}

/**
 * Get participant name by ID from a participants array
 * @param {string|number} participantId - The participant ID to find
 * @param {Array} participants - Array of participant objects
 * @param {string} eventType - The event type
 * @param {Object} options - Display options
 * @returns {string|Object} - Formatted name or JSX element
 */
export function getParticipantNameById(participantId, participants, eventType, options = {}) {
  if (!participantId || !participants) {
    return options.format === 'jsx' ? <span>TBD</span> : 'TBD';
  }

  // Find participant by ID (handle both string and number IDs)
  const participant = participants.find(p => 
    String(p.id) === String(participantId) || 
    String(p.userId) === String(participantId) ||
    String(p.user_id) === String(participantId)
  );

  if (!participant) {
    const fallback = `Player ${participantId}`;
    return options.format === 'jsx' ? <span>{fallback}</span> : fallback;
  }

  return getParticipantDisplayName(participant, eventType, options);
}

/**
 * Format participant data for consistent structure across components
 * @param {Object} rawParticipant - Raw participant data from API
 * @param {string} eventType - The event type
 * @returns {Object} - Normalized participant object
 */
export function normalizeParticipantData(rawParticipant) {
  if (!rawParticipant) return null;

  return {
    id: rawParticipant.id,
    name: rawParticipant.name || rawParticipant.username,
    userId: rawParticipant.userId || rawParticipant.user_id,
    teamName: rawParticipant.team_name || rawParticipant.teamName,
    members: (rawParticipant.members || []).map(member => ({
      id: member.id,
      name: member.name || member.username,
      userId: member.userId || member.user_id
    })),
    partner: rawParticipant.partner,
    // Additional fields that might be useful
    email: rawParticipant.email,
    phone: rawParticipant.phone,
    registrationId: rawParticipant.registrationId
  };
}

/**
 * Get team members list for display
 * @param {Object} participant - The participant object
 * @returns {Array} - Array of team member objects
 */
export function getTeamMembers(participant) {
  if (!participant) return [];
  
  const members = participant.members || [];
  return members.map(member => ({
    id: member.id,
    name: member.name || member.username,
    userId: member.userId || member.user_id
  }));
}

/**
 * Check if a participant has team members
 * @param {Object} participant - The participant object
 * @returns {boolean} - True if participant has team members
 */
export function hasTeamMembers(participant) {
  return participant && participant.members && participant.members.length > 0;
}

/**
 * Get the team captain/leader name
 * @param {Object} participant - The participant object
 * @returns {string} - Captain name
 */
export function getTeamCaptain(participant) {
  if (!participant) return 'Unknown';
  return participant.name || participant.username || 'Unknown';
}

/**
 * Generate a team display name automatically if none exists
 * @param {Object} participant - The participant object
 * @param {string} eventType - The event type
 * @returns {string} - Generated team name
 */
export function generateTeamName(participant, eventType) {
  if (!participant) return 'Unknown Team';

  const captain = getTeamCaptain(participant);
  
  if (eventType === 'duo') {
    const members = getTeamMembers(participant);
    if (members.length > 0) {
      return `${captain} & ${members[0].name}`;
    }
    return captain;
  }

  if (eventType === 'team') {
    return `${captain}'s Team`;
  }

  return captain;
}

/**
 * React component wrapper for participant names
 * @param {Object} props - Component props
 * @returns {JSX.Element} - Formatted participant name component
 */
export function ParticipantName({ 
  participant, 
  participantId, 
  participants, 
  eventType, 
  className = '', 
  styles = {},
  showTeamName = true,
  showPartnerNames = true,
  separator = ' & '
}) {
  const options = {
    format: 'jsx',
    showTeamName,
    showPartnerNames,
    separator,
    className,
    styles
  };

  if (participantId && participants) {
    return getParticipantNameById(participantId, participants, eventType, options);
  }

  return getParticipantDisplayName(participant, eventType, options);
} 