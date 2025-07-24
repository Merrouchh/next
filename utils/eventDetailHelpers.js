/**
 * Event Detail Utility Functions
 * Extracted from pages/events/[id].js for better organization
 */

// iOS detection utility
export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Format date for display
export const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
};

// Session retry utility - reusable across different functions
export const retryGetSession = async (supabase, maxRetries = 3, delayMs = 300) => {
  let accessToken = null;
  let retryCount = 0;
  
  while (!accessToken && retryCount < maxRetries) {
    console.log(`[Session Retry] Attempt ${retryCount + 1}/${maxRetries}`);
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData?.session?.access_token;
    } catch (sessionError) {
      console.error(`[Session Retry] Error:`, sessionError);
    }
    
    retryCount++;
  }
  
  return accessToken;
};

// Get registration button text
export const getRegistrationButtonText = (event, registrationStatus, isPublicView) => {
  if (!event || registrationStatus.isLoading) {
    return 'Loading...';
  }
  
  if (event.status === 'Completed') {
    return 'Event Ended';
  }
  
  if (event.status === 'In Progress') {
    return 'In Progress';
  }
  
  // Check if registration is full
  if (registrationStatus.registrationLimit !== null && 
      registrationStatus.registeredCount >= registrationStatus.registrationLimit &&
      !registrationStatus.isRegistered) {
    return 'Registration Full';
  }
  
  // For public users on upcoming events
  if (isPublicView) {
    return event.status === 'Upcoming' ? 'Login to Register' : 'Register Now';
  }
  
  if (registrationStatus.isRegistered) {
    if (registrationStatus.registeredBy) {
      return `Registered by ${registrationStatus.registeredBy}`;
    } else {
      return 'Registered';
    }
  }
  
  return 'Register Now';
};

// Get registration button class
export const getRegistrationButtonClass = (event, registrationStatus, styles) => {
  const baseClass = styles.registerButton;
  
  if (!event || registrationStatus.isLoading) {
    return `${baseClass} ${styles.loadingButton}`;
  }
  
  if (event.status === 'Completed') {
    return `${baseClass} ${styles.completedButton}`;
  }
  
  if (event.status === 'In Progress') {
    return `${baseClass} ${styles.inProgressButton}`;
  }
  
  // Check if registration is full
  if (registrationStatus.registrationLimit !== null && 
      registrationStatus.registeredCount >= registrationStatus.registrationLimit &&
      !registrationStatus.isRegistered) {
    return `${baseClass} ${styles.fullButton}`;
  }
  
  if (registrationStatus.isRegistered) {
    if (registrationStatus.registeredBy) {
      return `${baseClass} ${styles.teamMemberButton}`;
    } else {
      return `${baseClass} ${styles.registeredButton}`;
    }
  }
  
  return baseClass;
};

// Check if registration button should be disabled
export const isRegistrationButtonDisabled = (event, registrationStatus) => {
  if (!event || registrationStatus.isLoading) {
    return true;
  }
  
  if (event.status !== 'Upcoming') {
    return true;
  }
  
  // Check if registration is full (but allow cancellation)
  if (registrationStatus.registrationLimit !== null && 
      registrationStatus.registeredCount >= registrationStatus.registrationLimit &&
      !registrationStatus.isRegistered) {
    return true;
  }
  
  return false;
};

// Validate team selection for registration
export const validateTeamSelection = (teamType, selectedTeamMembers, teamName) => {
  // For duo events, ensure exactly one team member is selected
  if (teamType === 'duo' && selectedTeamMembers.length !== 1) {
    return 'Please select exactly one team partner for duo events';
  }
  
  // For team events, ensure at least one team member is selected
  if (teamType === 'team' && selectedTeamMembers.length === 0) {
    return 'Please select at least one team member';
  }
  
  // For team events, ensure team name is provided
  if (teamType === 'team' && (!teamName || teamName.trim() === '')) {
    return 'Please provide a name for your team';
  }
  
  return null; // No validation errors
};

// Generate team name for duo events
export const generateDuoTeamName = (user, selectedTeamMembers) => {
  if (selectedTeamMembers.length === 1 && user) {
    const userName = user.username || user.email?.split('@')[0] || 'You';
    return `${userName} & ${selectedTeamMembers[0].username}`;
  }
  return '';
};

// Handle team member selection logic
export const handleTeamMemberSelection = (member, selectedTeamMembers, teamType, user, setSelectedTeamMembers, setTeamName) => {
  // Check if member is already selected
  const isSelected = selectedTeamMembers.some(m => m.userId === member.id);
  
  if (isSelected) {
    // Remove member
    const newSelection = selectedTeamMembers.filter(m => m.userId !== member.id);
    setSelectedTeamMembers(newSelection);
    
    // For duo events, clear out the auto-generated team name if we removed the partner
    if (teamType === 'duo' && newSelection.length === 0) {
      setTeamName('');
    }
  } else {
    // Add member
    if (teamType === 'duo' && selectedTeamMembers.length >= 1) {
      // For duo events, replace the existing selection
      const newSelection = [{ userId: member.id, username: member.username }];
      setSelectedTeamMembers(newSelection);
      
      // Auto-generate team name for duo events
      setTeamName(generateDuoTeamName(user, newSelection));
    } else if (teamType === 'duo' && selectedTeamMembers.length === 0) {
      // For duo events, add the first partner and generate team name
      const newSelection = [{ userId: member.id, username: member.username }];
      setSelectedTeamMembers(newSelection);
      
      // Auto-generate team name for duo events
      setTeamName(generateDuoTeamName(user, newSelection));
    } else {
      // For team events, add to the selection
      setSelectedTeamMembers(prev => [...prev, { userId: member.id, username: member.username }]);
    }
  }
};

// Create initial registration status state
export const createInitialRegistrationStatus = () => ({
  isRegistered: false,
  isLoading: true,
  registeredCount: 0,
  registrationLimit: null,
  teamMembers: [],
  availableTeamMembers: [],
  registeredBy: null
});

// Create API headers with authentication
export const createAuthHeaders = (accessToken) => ({
  'Content-Type': 'application/json',
  ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
}); 