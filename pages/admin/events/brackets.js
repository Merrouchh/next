import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaCalendarAlt, FaTrophy, FaEdit, FaClock, FaExchangeAlt, FaCrown, FaRandom, FaCheck, FaTimes, FaExclamationTriangle, FaUndo } from 'react-icons/fa';
import styles from '../../../styles/AdminBracketManager.module.css';
import sharedStyles from '../../../styles/Shared.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import AdminPageWrapper from '../../../components/AdminPageWrapper';
import { toast } from 'react-hot-toast';

export default function BracketManager() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [bracketData, setBracketData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchDetails, setMatchDetails] = useState({
    scheduledTime: '',
    location: '',
    notes: ''
  });
  const [showSelectParticipantModal, setShowSelectParticipantModal] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState([]);
  const [participantToReplace, setParticipantToReplace] = useState(null);
  const [lastScheduledTime, setLastScheduledTime] = useState('');
  const [expandedRounds, setExpandedRounds] = useState({});
  const scrollPositionRef = useRef({ 
    bracketSection: { x: 0, y: 0 },
    bracketMatchesList: { x: 0, y: 0 },
    window: { x: 0, y: 0 }
  });

  // Load last scheduled time from localStorage on component mount
  useEffect(() => {
    try {
      const storedTime = localStorage.getItem('lastScheduledTime');
      if (storedTime) {
        console.log('Loaded last scheduled time from localStorage:', storedTime);
        setLastScheduledTime(storedTime);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }, []);

  // Format datetime string for form input
  const formatDatetimeForInput = (datetimeString) => {
    if (!datetimeString) return '';
    try {
      const date = new Date(datetimeString);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
      console.error('Error formatting datetime for input:', e);
      return '';
    }
  };

  // Parse time with AM/PM awareness - updated to better handle mobile input
  const parseTimeWithMeridiem = (timeStr) => {
    try {
      if (!timeStr) return null;
      
      console.log('Parsing time input:', timeStr);
      
      // Check for 12-hour format or handle the datetime-local input
      const timePart = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
      
      // Parse the hours and minutes
      let hours, minutes;
      
      if (timePart.includes(':')) {
        const timeParts = timePart.split(':');
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        
        // Validate parsed values
        if (isNaN(hours) || isNaN(minutes)) {
          console.error('Invalid time format', { hours, minutes });
          return null;
        }
        
        // Handle mobile format issues - ensure hours is between 0-23
        if (hours < 0 || hours > 23) {
          console.error('Hours out of range:', hours);
          return null;
        }
        
        // Ensure minutes is between 0-59
        if (minutes < 0 || minutes > 59) {
          console.error('Minutes out of range:', minutes);
          return null;
        }
        
        console.log('Successfully parsed time:', { hours, minutes });
      } else {
        console.error('Time format does not include colon');
        return null;
      }
      
      // Return the parsed time
      return { hours, minutes };
    } catch (e) {
      console.error('Error parsing time with meridiem:', e);
      return null;
    }
  };

  // Fetch events with brackets
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          throw new Error('No authentication token available');
        }
        
        // First, get all events
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id, title, date, image, registration_limit, team_type')
          .order('date', { ascending: false });
        
        if (eventsError) throw eventsError;
        
        // Then, find which events have brackets
        const { data: bracketsData, error: bracketsError } = await supabase
          .from('event_brackets')
          .select('event_id, created_at, updated_at');
        
        if (bracketsError) throw bracketsError;
        
        // Mark events that have brackets and merge data
        const eventsWithBracketInfo = eventsData.map(event => {
          const bracketInfo = bracketsData.find(b => b.event_id === event.id);
          return {
            ...event,
            hasBracket: !!bracketInfo,
            bracketCreatedAt: bracketInfo?.created_at || null,
            bracketUpdatedAt: bracketInfo?.updated_at || null
          };
        });
        
        // Sort: events with brackets first, then by date
        const sortedEvents = eventsWithBracketInfo.sort((a, b) => {
          if (a.hasBracket && !b.hasBracket) return -1;
          if (!a.hasBracket && b.hasBracket) return 1;
          
          // If both have brackets or both don't, sort by date (newest first)
          return new Date(b.date) - new Date(a.date);
        });
        
        setEvents(sortedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to load events. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [supabase, user]);

  // Function to handle opponent swapping
  const handleChangeOpponent = async (participantPosition) => {
    if (!selectedMatch || !selectedEvent) return;
    
    // Check if this is a first-round match
    const isFirstRound = bracketData && 
      bracketData.length > 0 && 
      bracketData[0].some(m => m.id === selectedMatch.id);
    
    if (!isFirstRound) {
      alert("Opponent changes are only allowed in the first round.");
      return;
    }
    
    if (selectedMatch.winnerId) {
      alert("Cannot swap opponents for a match that already has a winner.");
      return;
    }
    
    setLoading(true);
    
    try {
      // Find all first-round matches without winners
      const firstRoundMatchesWithoutWinners = bracketData[0].filter(m => !m.winnerId);
      
      // Get the current participant we want to swap
      const currentParticipantId = participantPosition === 'participant1' 
        ? selectedMatch.participant1Id 
        : selectedMatch.participant2Id;
      
      // Skip if it's a bye or null
      if (!currentParticipantId || currentParticipantId === 'bye') {
        alert("Cannot swap a bye or empty slot. Please add a participant first.");
        setLoading(false);
        return;
      }
      
      // Get all available participants from all first-round matches
      // We'll allow swapping with any participant from matches that don't have a winner yet
      const swappableParticipants = [];
      
      firstRoundMatchesWithoutWinners.forEach(match => {
        // Skip the current match as we don't need to swap with self
        if (match.id === selectedMatch.id) return;
        
        // Add participant 1 if it exists and isn't a bye
        if (match.participant1Id && match.participant1Id !== 'bye') {
          const participant = participants.find(p => p.id === match.participant1Id);
          if (participant) {
            swappableParticipants.push({
              ...participant,
              matchId: match.id,
              position: 'participant1',
              opponentId: match.participant2Id,
              opponentName: match.participant2Name
            });
          }
        }
        
        // Add participant 2 if it exists and isn't a bye
        if (match.participant2Id && match.participant2Id !== 'bye') {
          const participant = participants.find(p => p.id === match.participant2Id);
          if (participant) {
            swappableParticipants.push({
              ...participant,
              matchId: match.id,
              position: 'participant2',
              opponentId: match.participant1Id,
              opponentName: match.participant1Name
            });
          }
        }
      });
      
      // Also add participants that aren't in any match yet
      const participantsInMatches = new Set();
      bracketData[0].forEach(match => {
        if (match.participant1Id && match.participant1Id !== 'bye') {
          participantsInMatches.add(match.participant1Id);
        }
        if (match.participant2Id && match.participant2Id !== 'bye') {
          participantsInMatches.add(match.participant2Id);
        }
      });
      
      // Add unassigned participants (those not in any match)
      participants.forEach(participant => {
        if (!participantsInMatches.has(participant.id)) {
          swappableParticipants.push({
            ...participant,
            matchId: null,
            position: null,
            opponentId: null,
            opponentName: null,
            isUnassigned: true
          });
        }
      });
      
      if (swappableParticipants.length === 0) {
        alert("No available participants to swap with. All participants are either in completed matches or are byes.");
        setLoading(false);
        return;
      }
      
      // Show custom participant selection modal
      setAvailableParticipants(swappableParticipants);
      setParticipantToReplace({
        position: participantPosition,
        currentId: currentParticipantId,
        currentName: participantPosition === 'participant1' 
          ? getParticipantName(selectedMatch.participant1Id)
          : getParticipantName(selectedMatch.participant2Id),
        matchId: selectedMatch.id
      });
      setShowSelectParticipantModal(true);
      setLoading(false);
    } catch (error) {
      console.error('Error preparing opponent swap:', error);
      setError('Failed to prepare opponent swap. Please try again.');
      setLoading(false);
    }
  };

  // Complete the opponent change after selection from modal - now performs a true swap
  const completeOpponentChange = async (swapParticipant) => {
    if (!selectedMatch || !selectedEvent || !participantToReplace) return;
    
    setLoading(true);
    setShowSelectParticipantModal(false);
    
    try {
      // Get the current bracket data from the database
      const { data: dbBracketData, error: bracketError } = await supabase
        .from('event_brackets')
        .select('matches, id')
        .eq('event_id', selectedEvent.id)
        .single();
      
      if (bracketError) throw bracketError;
      
      // Create a copy of the matches
      const updatedMatches = JSON.parse(JSON.stringify(dbBracketData.matches));
      
      // Get the first round matches
      const firstRoundMatches = updatedMatches[0];
      
      // Find our current match in the first round
      const currentMatchIndex = firstRoundMatches.findIndex(
        match => match.id === selectedMatch.id
      );
      
      if (currentMatchIndex === -1) {
        throw new Error("Current match not found in first round");
      }
      
      // Get references to the participant we want to replace
      const currentParticipantId = participantToReplace.currentId;
      const currentPosition = participantToReplace.position;
      
      if (swapParticipant.isUnassigned) {
        // If the selected participant is unassigned, just replace in the current match
        firstRoundMatches[currentMatchIndex] = {
          ...firstRoundMatches[currentMatchIndex],
          [`${currentPosition}Id`]: swapParticipant.id,
          [`${currentPosition}Name`]: swapParticipant.name
        };
      } else {
        // Get the match where the selected participant is currently placed
        const swapMatchIndex = firstRoundMatches.findIndex(
          match => match.id === swapParticipant.matchId
        );
        
        if (swapMatchIndex === -1) {
          throw new Error("Swap participant match not found");
        }
        
        // Get the position of the swap participant in their match
        const swapPosition = swapParticipant.position;
        
        // Now perform the swap
        // 1. Store the current participant's info
        const currentParticipantName = firstRoundMatches[currentMatchIndex][`${currentPosition}Name`];
        
        // 2. Store the swap participant's info
        const swapParticipantId = firstRoundMatches[swapMatchIndex][`${swapPosition}Id`];
        const swapParticipantName = firstRoundMatches[swapMatchIndex][`${swapPosition}Name`];
        
        // 3. Update the current match with the swap participant's info
        firstRoundMatches[currentMatchIndex] = {
          ...firstRoundMatches[currentMatchIndex],
          [`${currentPosition}Id`]: swapParticipantId,
          [`${currentPosition}Name`]: swapParticipantName
        };
        
        // 4. Update the swap match with the current participant's info
        firstRoundMatches[swapMatchIndex] = {
          ...firstRoundMatches[swapMatchIndex],
          [`${swapPosition}Id`]: currentParticipantId,
          [`${swapPosition}Name`]: currentParticipantName
        };
      }
      
      // Save the updated bracket back to the database
      const { error: updateError } = await supabase
        .from('event_brackets')
        .update({ 
          matches: updatedMatches,
          updated_at: new Date()
        })
        .eq('id', dbBracketData.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setBracketData(updatedMatches);
      setSelectedMatch(null);
      
      if (swapParticipant.isUnassigned) {
        alert(`Replaced ${participantToReplace.currentName} with ${swapParticipant.name}`);
      } else {
        alert(`Successfully swapped ${participantToReplace.currentName} with ${swapParticipant.name}`);
      }
    } catch (error) {
      console.error('Error swapping participants:', error);
      setError('Failed to swap participants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a match is in the first round
  const isFirstRoundMatch = () => {
    if (!selectedMatch || !bracketData || bracketData.length === 0) return false;
    return bracketData[0].some(m => m.id === selectedMatch.id);
  };

  // Function to handle setting a winner for a match
  const handleSetWinner = async (matchId, participantId) => {
    if (loading) return;
    
    if (!confirm(`Are you sure you want to set this participant as the winner? This will advance them to the next round.`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Update match with winner
      const response = await fetch(`/api/events/${selectedEvent.id}/bracket`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          matchId: matchId,
          winnerId: participantId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update match: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        // Update our local state
        setBracketData(data.bracket);
        toast.success('Winner set successfully!');
      }
      
      setSelectedMatch(null);
    } catch (error) {
      console.error('Error setting winner:', error);
      setError(error.message || 'Failed to set winner');
      toast.error(`Error: ${error.message || 'Failed to set winner'}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle clearing a winner from a match
  const handleClearWinner = async () => {
    if (loading || !selectedMatch) return;
    
    if (!confirm(`Are you sure you want to clear the winner? This will remove the participant from all subsequent rounds.`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Clear the winner using the clear-winner API endpoint
      const response = await fetch(`/api/events/${selectedEvent.id}/bracket/clear-winner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          matchId: selectedMatch.id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to clear match winner: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        // Update our local state
        setBracketData(data.bracket);
        
        // Find the updated match in the bracket data
        const updatedMatch = findMatchInBracket(data.bracket, selectedMatch.id);
        
        if (updatedMatch) {
          // Important: Create a complete copy of the match to ensure React detects the change
          const updatedMatchCopy = JSON.parse(JSON.stringify(updatedMatch));
          console.log('Updated match after clearing winner:', updatedMatchCopy);
          
          // Ensure the winnerId is definitely cleared
          updatedMatchCopy.winnerId = null;
          
          // Update the selected match with the cleared winner
          setSelectedMatch(updatedMatchCopy);
        } else {
          // If we can't find the match, close the modal
          console.error('Could not find the updated match in bracket data');
          setSelectedMatch(null);
        }
        
        toast.success('Winner has been cleared successfully');
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Error clearing winner:', error);
      setError(error.message || 'Failed to clear winner');
      toast.error(`Error: ${error.message || 'Failed to clear winner'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to find a match in the bracket data
  const findMatchInBracket = (bracketData, matchId) => {
    if (!bracketData) return null;
    
    for (const round of bracketData) {
      const match = round.find(m => m.id === matchId);
      if (match) return match;
    }
    
    return null;
  };

  // Get participant name by ID with team member names for duos
  const getParticipantName = (participantId) => {
    if (!participantId) return 'TBD';
    const participant = participants.find(p => p.id === participantId);
    
    if (!participant) return 'Unknown';
    
    if (participant.members && participant.members.length > 0) {
      return `${participant.name} & ${participant.members.map(m => m.name).join(', ')}`;
    }
    
    return participant.name;
  };

  // Handle event selection
  const handleEventSelect = async (event) => {
    if (!event.hasBracket) {
      // If event doesn't have a bracket, prompt to create one
      if (confirm(`No bracket exists for "${event.title}". Would you like to create one?`)) {
        router.push(`/events/${event.id}/bracket`);
      }
      return;
    }
    
    setSelectedEvent(event);
    await fetchBracketData(event.id);
  };

  // Helper function to find the previous match time
  const findPreviousMatchTime = (matchId) => {
    if (!bracketData) return '';
    
    // Look for the previous match number (e.g., if current is 22, look for 21)
    const previousMatchId = matchId - 1;
    console.log('Looking for previous match:', previousMatchId);
    
    // Find the previous match in the bracket data
    for (const round of bracketData) {
      const previousMatch = round.find(m => m.id === previousMatchId);
      if (previousMatch && previousMatch.scheduledTime) {
        const formattedTime = formatDatetimeForInput(previousMatch.scheduledTime);
        console.log('Found previous match with time:', formattedTime);
        return formattedTime;
      }
    }
    
    return '';
  };

  // Handle match click for admin
  const handleMatchClick = (match) => {
    if (!match) return;
    
    setSelectedMatch(match);
    console.log('Match clicked:', match);
    
    // Log all match details for debugging
    console.log('Match details when clicked:', {
      id: match.id,
      scheduledTime: match.scheduledTime,
      formattedTime: match.scheduledTime ? formatDatetimeForInput(match.scheduledTime) : '',
      location: match.location,
      notes: match.notes
    });
    
    // Find which round this match belongs to
    if (bracketData) {
      const roundIndex = bracketData.findIndex(round => 
        round.some(m => m.id === match.id)
      );
      
      if (roundIndex !== -1) {
        // Make sure this round is expanded
        setExpandedRounds(prev => ({
          ...prev,
          [roundIndex]: true
        }));
      }
    }
    
    // Try to get last scheduled time from localStorage
    let storedLastTime = '';
    try {
      storedLastTime = localStorage.getItem('lastScheduledTime') || '';
    } catch (e) {
      console.error('Error accessing localStorage:', e);
    }
    
    // Get previous match time using our helper function
    const previousMatchTime = findPreviousMatchTime(match.id);
    
    // Format the scheduledTime for the input element if it exists
    const formattedTime = match.scheduledTime ? formatDatetimeForInput(match.scheduledTime) : '';
    
    // Initialize matchDetails with existing data from the match
    // Log the notes for debugging purposes
    console.log('Setting match details to:', {
      scheduledTime: formattedTime,
      location: match.location || '',
      notes: match.notes || ''
    });
    
    setMatchDetails({
      scheduledTime: formattedTime,
      location: match.location || '',
      notes: match.notes || ''
    });
    
    // If this match doesn't have a scheduled time yet, use available template times
    if (!match.scheduledTime) {
      console.log('No scheduled time, checking conditions...');
      console.log('Stored last time:', storedLastTime);
      console.log('Previous match time:', previousMatchTime);
      
      // Always apply a template time if one is available, regardless of whether
      // the match has participants assigned or not
      if (previousMatchTime) {
        console.log('Using previous match time as template');
        setMatchDetails(prev => ({
          ...prev,
          scheduledTime: previousMatchTime
        }));
      } else if (storedLastTime) {
        console.log('Using stored last scheduled time as template');
        setMatchDetails(prev => ({
          ...prev,
          scheduledTime: storedLastTime
        }));
      }
    }
  };

  // Fetch bracket data for a specific event
  const fetchBracketData = async (eventId) => {
    setLoading(true);
    console.log('Fetching bracket data for event:', eventId);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/events/${eventId}/bracket`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.status === 404) {
        console.log('No bracket data found (404)');
        setBracketData(null);
        setParticipants([]);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch bracket data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received bracket data from API:', data);
      
      if (data && data.bracket) {
        // Fetch additional match details from database if they exist
        console.log('Fetching match details for event:', eventId);
        const { data: matchDetailsData, error: matchDetailsError } = await supabase
          .from('event_match_details')
          .select('*')
          .eq('event_id', eventId);
        
        if (matchDetailsError) {
          console.error('Error fetching match details:', matchDetailsError);
        }
        
        console.log('Match details data from database:', matchDetailsData);
        
        // Create a deep copy of the bracket data to avoid reference issues
        let enrichedBracket = JSON.parse(JSON.stringify(data.bracket));
        
        // If we have additional match details, merge them into the bracket data
        if (!matchDetailsError && matchDetailsData && matchDetailsData.length > 0) {
          console.log('Enriching bracket with match details - found', matchDetailsData.length, 'details records');
          
          // Create a map for faster lookups
          const detailsMap = {};
          matchDetailsData.forEach(detail => {
            if (detail && detail.match_id) {
              detailsMap[detail.match_id] = detail;
            }
          });
          
          // Log the first few entries in the details map to verify
          const sampleKeys = Object.keys(detailsMap).slice(0, 3);
          sampleKeys.forEach(key => {
            console.log(`Details map entry for match ${key}:`, detailsMap[key]);
          });
          
          // Apply details to each match
          for (let r = 0; r < enrichedBracket.length; r++) {
            for (let m = 0; m < enrichedBracket[r].length; m++) {
              const match = enrichedBracket[r][m];
              const details = detailsMap[match.id];
              
              if (details) {
                console.log(`Found details for match ${match.id}:`, details);
                // Explicitly handle each field to avoid undefined/null issues
                enrichedBracket[r][m] = {
                  ...match,
                  scheduledTime: details.scheduled_time || '',
                  location: details.location || '',
                  notes: details.notes || ''
                };
              } else {
                // Ensure match always has these properties even if no details exist
                enrichedBracket[r][m] = {
                  ...match,
                  scheduledTime: match.scheduledTime || '',
                  location: match.location || '',
                  notes: match.notes || ''
                };
              }
            }
          }
          
          const sampleMatch = enrichedBracket[0][0];
          console.log('Enriched bracket with match details. Sample match:', {
            id: sampleMatch.id,
            scheduledTime: sampleMatch.scheduledTime,
            location: sampleMatch.location,
            notes: sampleMatch.notes
          });
        } else {
          console.log('No match details found to enrich bracket data');
          // Still ensure all matches have the expected properties
          for (let r = 0; r < enrichedBracket.length; r++) {
            for (let m = 0; m < enrichedBracket[r].length; m++) {
              const match = enrichedBracket[r][m];
              enrichedBracket[r][m] = {
                ...match,
                scheduledTime: match.scheduledTime || '',
                location: match.location || '',
                notes: match.notes || ''
              };
            }
          }
        }
        
        console.log('Setting enriched bracket data with first match:', enrichedBracket[0][0]);
        setBracketData(enrichedBracket);
        setParticipants(data.participants || []);
        
        // Initialize expanded rounds - ensure the first round is expanded by default
        const initialExpandedState = {};
        enrichedBracket.forEach((_, index) => {
          // Expand only the first round by default
          initialExpandedState[index] = index === 0;
        });
        setExpandedRounds(initialExpandedState);
      } else {
        console.log('No valid bracket data in response');
        setBracketData(null);
        setParticipants([]);
      }
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      setError(error.message || 'Failed to load bracket data');
    } finally {
      setLoading(false);
    }
  };

  // Create a helper function to format and validate time input
  const validateAndFormatScheduledTime = (timeInput) => {
    if (!timeInput) return null;
    
    console.log('Validating time input:', timeInput);
    
    try {
      // Handle potential input format issues
      let inputToUse = timeInput;
      
      // Check if input contains the 'T' separator for datetime-local
      if (!inputToUse.includes('T') && inputToUse.includes(' ')) {
        // Try to convert space-separated format to T-separated format
        console.log('Converting space-separated format to T-separated format');
        const [datePart, timePart] = inputToUse.split(' ');
        if (datePart && timePart) {
          inputToUse = `${datePart}T${timePart}`;
          console.log('Converted input:', inputToUse);
        }
      }
      
      // Parse the time components to ensure correct format
      const parsedTime = parseTimeWithMeridiem(inputToUse);
      console.log('Parsed time components:', parsedTime);
      
      if (parsedTime) {
        // Create a new date with these exact hour/minute values
        let date;
        
        try {
          date = new Date(inputToUse);
          
          // Check if the date is valid
          if (isNaN(date.getTime())) {
            console.error('Invalid date created from input');
            return null;
          }
          
          // Force the specific hours and minutes to make sure they're preserved
          date.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
          
          // If hours don't match what we set, there might be a timezone issue
          const actualHours = date.getHours();
          if (actualHours !== parsedTime.hours) {
            console.log('Hours mismatch, adjusting for timezone issue', { 
              expected: parsedTime.hours, 
              actual: actualHours 
            });
            
            // Try to correct by creating a new Date with the local timezone offset
            const localDate = new Date();
            const timezoneOffset = localDate.getTimezoneOffset() * 60000; // convert to milliseconds
            
            // Try to create a date with timezone adjustment
            date = new Date(date.getTime() - timezoneOffset);
            date.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
          }
          
          // Format for database (ISO string)
          const formattedTime = date.toISOString();
          console.log('Final scheduled time for database:', formattedTime);
          console.log('Time in local format:', date.toString());
          
          return formattedTime;
        } catch (dateError) {
          console.error('Error creating date object:', dateError);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Validation error:', error);
      return null;
    }
  };

  // Create a helper function to handle datetime input changes
  const handleDatetimeInputChange = (value) => {
    console.log("Time changed to:", value);
    
    // Empty value case
    if (!value) {
      setMatchDetails(prev => ({...prev, scheduledTime: ''}));
      return;
    }
    
    // Handle potential format differences from mobile devices
    let formattedValue = value;
    
    // Special handling for mobile inputs that might include spaces instead of T
    if (value.includes(' ') && !value.includes('T')) {
      try {
        // Try to normalize the format from "YYYY-MM-DD HH:MM" to "YYYY-MM-DDThh:mm"
        const [datePart, timePart] = value.split(' ');
        if (datePart && timePart) {
          formattedValue = `${datePart}T${timePart}`;
          console.log("Normalized space-separated format to:", formattedValue);
        }
      } catch (e) {
        console.error("Error normalizing datetime format:", e);
      }
    }
    
    // Check if this might be a default 12:00 time
    try {
      const date = new Date(formattedValue);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      console.log("Time parsed as:", date.toString());
      console.log("Hours detected:", hours, "Minutes:", minutes);
      
      // Try to extract input hour directly from string to avoid timezone issues
      let inputHour, inputMinutes;
      
      if (formattedValue.includes('T')) {
        [inputHour, inputMinutes] = formattedValue.split('T')[1].split(':').map(num => parseInt(num, 10));
      } else if (formattedValue.includes(' ')) {
        [inputHour, inputMinutes] = formattedValue.split(' ')[1].split(':').map(num => parseInt(num, 10));
      }
      
      console.log("Direct extraction from input string - Hour:", inputHour, "Minutes:", inputMinutes);
      
      // If input hour is valid and different from parsed hour (timezone issue)
      if (!isNaN(inputHour) && !isNaN(inputMinutes) && inputHour !== hours) {
        console.log("Detected time parsing issue, using directly extracted time");
        
        // Create adjusted value using the extracted values
        const [datePart] = formattedValue.includes('T') 
          ? formattedValue.split('T') 
          : formattedValue.split(' ');
          
        const adjustedValue = `${datePart}T${String(inputHour).padStart(2, '0')}:${String(inputMinutes).padStart(2, '0')}`;
        console.log("Using directly extracted time:", adjustedValue);
        
        setMatchDetails(prev => ({...prev, scheduledTime: adjustedValue}));
        return;
      }
      
      // If it's exactly 12:00, and user just selected a date (browser default behavior)
      if (hours === 12 && minutes === 0) {
        console.log("Detected browser default time, adjusting to 16:00");
        // Create a new date with 4 PM instead
        date.setHours(16, 0, 0, 0);
        
        // Format back to HTML datetime-local format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const adjustedHours = "16";
        const adjustedMinutes = "00";
        
        const adjustedValue = `${year}-${month}-${day}T${adjustedHours}:${adjustedMinutes}`;
        console.log("Adjusted time to:", adjustedValue);
        
        setMatchDetails(prev => ({...prev, scheduledTime: adjustedValue}));
        return;
      }
    } catch (e) {
      console.error("Error processing datetime input:", e);
    }
    
    // If not a special case, use the formatted value
    setMatchDetails(prev => ({...prev, scheduledTime: formattedValue}));
  };

  // Make a helper function to fetch the bracket data after saving match details
  const refreshBracketAfterSave = async (eventId) => {
    console.log('Refreshing bracket data after save for event:', eventId);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const response = await fetch(`/api/events/${eventId}/bracket`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to refresh bracket data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        // Fetch match details from database
        const { data: matchDetailsData, error: matchDetailsError } = await supabase
          .from('event_match_details')
          .select('*')
          .eq('event_id', eventId);
        
        if (matchDetailsError) {
          console.error('Error fetching match details:', matchDetailsError);
          return null;
        }
        
        console.log('Refreshed match details data from database:', matchDetailsData);
        
        // Create a deep copy of the bracket data
        let enrichedBracket = JSON.parse(JSON.stringify(data.bracket));
        
        // Create a map for faster lookups of match details
        const detailsMap = {};
        matchDetailsData.forEach(detail => {
          if (detail && detail.match_id) {
            detailsMap[detail.match_id] = detail;
          }
        });
        
        // Apply details to each match
        for (let r = 0; r < enrichedBracket.length; r++) {
          for (let m = 0; m < enrichedBracket[r].length; m++) {
            const match = enrichedBracket[r][m];
            const details = detailsMap[match.id];
            
            if (details) {
              console.log(`Found details for match ${match.id} during refresh:`, details);
              enrichedBracket[r][m] = {
                ...match,
                scheduledTime: details.scheduled_time || '',
                location: details.location || '',
                notes: details.notes || ''
              };
            } else {
              enrichedBracket[r][m] = {
                ...match,
                scheduledTime: '',
                location: '',
                notes: ''
              };
            }
          }
        }
        
        console.log('Refreshed bracket data with details applied');
        return enrichedBracket;
      }
      
      return null;
    } catch (error) {
      console.error('Error refreshing bracket data:', error);
      return null;
    }
  };

  // Update the handleSaveMatchDetails function to refresh data from the API after saving
  const handleSaveMatchDetails = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Save scroll position before any DOM updates
    saveScrollPosition();
    
    if (!selectedMatch || !selectedEvent) return;
    
    setLoading(true);
    
    try {
      console.log('Saving match details:', matchDetails);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Check if match details already exist for this match
      const { data: existingDetails, error: checkError } = await supabase
        .from('event_match_details')
        .select('id')
        .eq('event_id', selectedEvent.id)
        .eq('match_id', selectedMatch.id)
        .single();
      
      console.log('Existing details:', existingDetails);
      if (checkError) console.log('Check error:', checkError);
      
      // Process the scheduled time using our helper function
      const scheduledTime = validateAndFormatScheduledTime(matchDetails.scheduledTime);
      
      // Convert empty strings to null for proper database storage
      const location = matchDetails.location && matchDetails.location.trim() !== '' 
        ? matchDetails.location 
        : null;
        
      const notes = matchDetails.notes && matchDetails.notes.trim() !== '' 
        ? matchDetails.notes 
        : null;
      
      // Prepare the data to save - use null for empty strings to ensure database consistency
      const dataToSave = {
        scheduled_time: scheduledTime,
        location: location,
        notes: notes,
        updated_at: new Date()
      };
      
      console.log('Data to save:', dataToSave);
      
      // Save to database
      if (existingDetails) {
        // Update existing record
        const result = await supabase
          .from('event_match_details')
          .update(dataToSave)
          .eq('id', existingDetails.id)
          .select();
        
        console.log('Database update result:', result);
        
        if (result.error) {
          console.error('Error in database update operation:', result.error);
          throw result.error;
        }
      } else {
        // Insert new record
        const result = await supabase
          .from('event_match_details')
          .insert([
            {
              event_id: selectedEvent.id,
              match_id: selectedMatch.id,
              ...dataToSave
            }
          ])
          .select();
        
        console.log('Database insert result:', result);
        
        if (result.error) {
          console.error('Error in database insert operation:', result.error);
          throw result.error;
        }
      }
      
      // Store the last scheduled time for next match suggestion
      if (scheduledTime) {
        console.log('Setting last scheduled time:', scheduledTime);
        setLastScheduledTime(scheduledTime);
        
        try {
          const formattedForInput = formatDatetimeForInput(scheduledTime);
          console.log('Storing in localStorage:', formattedForInput);
          localStorage.setItem('lastScheduledTime', formattedForInput);
        } catch (e) {
          console.error('Error storing in localStorage:', e);
        }
      }
      
      // Fetch updated bracket data from API - CRITICAL: This ensures we get fresh data
      const refreshedBracket = await refreshBracketAfterSave(selectedEvent.id);
      
      // Show success message
      toast.success('Match details saved successfully!');
      
      // Update bracket data with refreshed data if available, otherwise keep current state
      if (refreshedBracket) {
        console.log('Setting refreshed bracket data');
        setBracketData(refreshedBracket);
      }
      
      // Close modal after updating state
      setTimeout(() => {
        setSelectedMatch(null);
        setLoading(false);
        
        // Restore scroll position with longer delay after all updates
        setTimeout(restoreScrollPosition, 100);
      }, 50);
      
    } catch (error) {
      console.error('Error saving match details:', error);
      setError('Failed to save match details. Please try again.');
      toast.error('Failed to save match details. Please try again.');
      setLoading(false);
      // Restore scroll position in case of error
      restoreScrollPosition();
    }
  };

  // Update handleSwapParticipants to preserve scroll position
  const handleSwapParticipants = async (matchId) => {
    // Save scroll position before any DOM updates
    saveScrollPosition();
    
    try {
      const response = await fetch(`/api/events/${selectedEvent.id}/match-details?action=swapParticipants&matchId=${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Update UI without reload
        setBracketData(prev => {
          const updated = { ...prev };
          // Find the match in the rounds
          for (let r = 0; r < updated.rounds.length; r++) {
            for (let m = 0; m < updated.rounds[r].matches.length; m++) {
              if (updated.rounds[r].matches[m].id === matchId) {
                // Swap the participants
                const match = { ...updated.rounds[r].matches[m] };
                const temp = match.participant1;
                match.participant1 = match.participant2;
                match.participant2 = temp;
                updated.rounds[r].matches[m] = match;
                break;
              }
            }
          }
          return updated;
        });
        
        toast.success('Participants swapped successfully');
      } else {
        const error = await response.text();
        toast.error(`Failed to swap participants: ${error}`);
      }
    } catch (error) {
      console.error('Error swapping participants:', error);
      toast.error(`Error swapping participants: ${error.message}`);
    } finally {
      // Restore scroll position after all DOM updates
      restoreScrollPosition();
    }
  };

  // Toggle round expansion
  const toggleRound = (roundIndex) => {
    // Save scroll position before toggling
    saveScrollPosition();
    
    setExpandedRounds(prev => ({
      ...prev,
      [roundIndex]: !prev[roundIndex]
    }));
    
    // Restore scroll position after state update
    setTimeout(restoreScrollPosition, 50);
  };

  // Toggle all rounds
  const toggleAllRounds = (expand) => {
    // Save scroll position before toggling all rounds
    saveScrollPosition();
    
    if (!bracketData) return;
    
    // Check if bracketData is an array (of rounds) or has a rounds property
    const rounds = Array.isArray(bracketData) ? bracketData : bracketData.rounds;
    
    if (!rounds || !rounds.length) {
      console.error('Invalid bracket data structure for toggling rounds:', bracketData);
      return;
    }
    
    const newState = {};
    rounds.forEach((_, index) => {
      newState[index] = expand;
    });
    
    console.log(`Setting all rounds to ${expand ? 'expanded' : 'collapsed'}:`, newState);
    setExpandedRounds(newState);
    
    // Restore scroll position after state update with a longer timeout
    setTimeout(restoreScrollPosition, 200);
  };

  // Add a helper function to check if a match is ready to play
  const isMatchReadyToPlay = (match) => {
    return !match.winnerId && 
      match.participant1Id && 
      match.participant2Id && 
      match.participant1Name !== 'TBD' && 
      match.participant2Name !== 'TBD' &&
      match.participant1Name !== 'Bye' && 
      match.participant2Name !== 'Bye';
  };

  // Helper function to view the public bracket in a new tab
  const handleViewPublicBracket = () => {
    // Set timestamp to force client-side cache bust
    const timestamp = Date.now();
    // Open the public bracket view in a new tab
    window.open(`/events/${selectedEvent?.id}/bracket?t=${timestamp}`, '_blank');
  };

  // Render match details modal
  const renderMatchDetailsModal = () => {
    if (!selectedMatch) return null;
    
    // Get participant names
    const participant1Name = getParticipantName(selectedMatch.participant1Id);
    const participant2Name = getParticipantName(selectedMatch.participant2Id);
    
    // Get the last scheduled time from previous match
    const previousMatchTime = findPreviousMatchTime(selectedMatch.id);
    
    // Check if both participants are valid and neither is a bye
    const canSelectWinner = isMatchReadyToPlay(selectedMatch);
    
    // Explicitly check if match has a winner to prevent UI issues
    const hasWinner = Boolean(selectedMatch.winnerId);
    
    // Log current match details and winner state for debugging
    console.log('Rendering modal with match details:', {
      matchId: selectedMatch.id,
      winnerId: selectedMatch.winnerId,
      hasWinner: hasWinner,
      scheduledTime: matchDetails.scheduledTime,
      location: matchDetails.location,
      notes: matchDetails.notes
    });
    
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3>Match #{selectedMatch.id} Details</h3>
            <button 
              className={styles.closeButton}
              onClick={() => setSelectedMatch(null)}
            >
              &times;
            </button>
          </div>
          <form 
            className={styles.modalBody}
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSaveMatchDetails(e);
            }}
          >
            <div className={styles.matchParticipants}>
              <div className={`${styles.modalParticipant} ${hasWinner && selectedMatch.winnerId === selectedMatch.participant1Id ? styles.winner : ''}`}>
                {participant1Name}
                {hasWinner && selectedMatch.winnerId === selectedMatch.participant1Id && (
                  <FaCrown className={styles.crownIcon} />
                )}
              </div>
              <div className={styles.versus}>vs</div>
              <div className={`${styles.modalParticipant} ${hasWinner && selectedMatch.winnerId === selectedMatch.participant2Id ? styles.winner : ''}`}>
                {participant2Name}
                {hasWinner && selectedMatch.winnerId === selectedMatch.participant2Id && (
                  <FaCrown className={styles.crownIcon} />
                )}
              </div>
            </div>
            
            {canSelectWinner && !hasWinner && (
              <div className={styles.winnerSelection}>
                <h4>Select Winner</h4>
                <div className={styles.winnerButtons}>
                  <button 
                    className={styles.winnerButton}
                    onClick={() => handleSetWinner(selectedMatch.id, selectedMatch.participant1Id)}
                    type="button"
                  >
                    {participant1Name} Wins
                  </button>
                  <button 
                    className={styles.winnerButton}
                    onClick={() => handleSetWinner(selectedMatch.id, selectedMatch.participant2Id)}
                    type="button"
                  >
                    {participant2Name} Wins
                  </button>
                </div>
              </div>
            )}
            
            {hasWinner && (
              <div className={styles.winnerDisplay}>
                <h4>Winner</h4>
                <div className={styles.winnerName}>
                  {selectedMatch.winnerId === selectedMatch.participant1Id ? participant1Name : participant2Name}
                </div>
                <button 
                  className={styles.undoWinnerButton}
                  onClick={handleClearWinner}
                  type="button"
                >
                  <FaUndo /> Undo Winner Selection
                </button>
              </div>
            )}
            
            {!hasWinner && isFirstRoundMatch() && (
              <div className={styles.opponentSwapSection}>
                <h4>Swap Participants</h4>
                <div className={styles.opponentButtons}>
                  <button 
                    className={styles.opponentButton} 
                    onClick={() => handleChangeOpponent('participant1')}
                    disabled={selectedMatch.participant1Id === 'bye'}
                    type="button"
                  >
                    <FaExchangeAlt /> Swap {participant1Name}
                  </button>
                  <button 
                    className={styles.opponentButton} 
                    onClick={() => handleChangeOpponent('participant2')}
                    disabled={selectedMatch.participant2Id === 'bye'}
                    type="button"
                  >
                    <FaExchangeAlt /> Swap {participant2Name}
                  </button>
                </div>
                <p className={styles.opponentNote}>
                  Note: You can swap with participants from other first-round matches or replace with unassigned participants.
                </p>
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label>Scheduled Time</label>
              <input 
                type="datetime-local" 
                value={matchDetails.scheduledTime} 
                onChange={(e) => handleDatetimeInputChange(e.target.value)}
                disabled={hasWinner}
                pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}"
                step="60"
              />
              <small className={styles.inputHelp}>
                Format: YYYY-MM-DD HH:MM (24-hour time)
              </small>
            </div>
            
            <div className={styles.formGroup}>
              <label>Location</label>
              <input 
                type="text" 
                value={matchDetails.location || ''} 
                onChange={(e) => setMatchDetails({...matchDetails, location: e.target.value})}
                placeholder="e.g., Station 3, Main Stage"
                disabled={hasWinner}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Notes</label>
              <textarea 
                value={matchDetails.notes || ''} 
                onChange={(e) => setMatchDetails({...matchDetails, notes: e.target.value})}
                placeholder="Any additional information about this match"
                rows={3}
                disabled={hasWinner}
              />
            </div>
            
            {(lastScheduledTime || previousMatchTime) && !matchDetails.scheduledTime && (
              <div className={styles.templateTimeInfo}>
                Using previous match time as template
              </div>
            )}
            
            <div className={styles.modalActions}>
              {!hasWinner && (
                <>
                  <button 
                    className={styles.swapButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSwapParticipants(selectedMatch.id);
                    }}
                    disabled={!selectedMatch.participant1Id || !selectedMatch.participant2Id}
                    type="button"
                  >
                    <FaExchangeAlt /> Swap Participants
                  </button>
                  
                  <button 
                    type="submit"
                    className={styles.saveButton}
                  >
                    Save Details
                  </button>
                </>
              )}
              
              <button 
                type="button"
                className={styles.viewBracketButton}
                onClick={handleViewPublicBracket}
              >
                <FaTrophy /> View Public Bracket
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Render custom participant selection modal
  const renderParticipantSelectionModal = () => {
    if (!showSelectParticipantModal || !participantToReplace) return null;
    
    return (
      <div className={styles.modalOverlay}>
        <div className={`${styles.modal} ${styles.selectParticipantModal}`}>
          <div className={styles.modalHeader}>
            <h3>Swap Opponent</h3>
            <button 
              className={styles.closeButton}
              onClick={() => setShowSelectParticipantModal(false)}
            >
              &times;
            </button>
          </div>
          <div className={styles.modalBody}>
            <p>
              Select a participant to swap with: <strong>{participantToReplace.currentName}</strong>
            </p>
            <div className={styles.participantsList}>
              {availableParticipants.length === 0 ? (
                <div className={styles.noParticipants}>No available participants</div>
              ) : (
                availableParticipants.map((participant) => {
                  const displayName = participant.members && participant.members.length > 0 
                    ? `${participant.name} & ${participant.members.map(m => m.name).join(', ')}`
                    : participant.name;
                    
                  return (
                    <div 
                      key={participant.id} 
                      className={styles.participantOption}
                      onClick={() => completeOpponentChange(participant)}
                    >
                      <div className={styles.participantName}>
                        {displayName}
                        {participant.isUnassigned && (
                          <span className={styles.unassignedBadge}>Not Assigned</span>
                        )}
                        {!participant.isUnassigned && (
                          <div className={styles.matchInfo}>
                            Currently in: Match #{participant.matchId} (vs {participant.opponentName})
                          </div>
                        )}
                      </div>
                      <FaExchangeAlt className={styles.swapIcon} />
                    </div>
                  );
                })
              )}
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowSelectParticipantModal(false)}
              >
                <FaTimes /> Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Update handleResetMatchTimes to preserve scroll position
  const handleResetMatchTimes = async () => {
    // Save scroll position before any DOM updates
    saveScrollPosition();
    
    if (!selectedEvent) return;
    
    try {
      const response = await fetch(`/api/events/${selectedEvent.id}/match-details?action=resetTimes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Instead of reloading, update the local bracket data by setting scheduledTime to null
        if (bracketData) {
          const updatedBracket = bracketData.map(round => {
            return round.map(match => {
              if (match.scheduledTime) {
                return { ...match, scheduledTime: null };
              }
              return match;
            });
          });
          
          setBracketData(updatedBracket);
        }
        
        toast.success('All match times have been reset successfully!');
      } else {
        const error = await response.text();
        toast.error(`Failed to reset match times: ${error}`);
      }
    } catch (error) {
      console.error('Error resetting match times:', error);
      toast.error(`Error resetting match times: ${error.message}`);
    } finally {
      // Restore scroll position after all DOM updates
      restoreScrollPosition();
    }
  };

  // Update handleDeleteBracket to preserve scroll position
  const handleDeleteBracket = async () => {
    if (!selectedEvent) return;
    
    // First confirmation with warning
    if (!confirm(`⚠️ WARNING: You are about to DELETE the entire bracket for "${selectedEvent.title}"\n\nThis will remove ALL match data, including:\n• Match winners\n• Scheduled times\n• Match locations\n• All notes\n\nThis action CANNOT be undone and all match scheduling information will be permanently lost!`)) {
      return;
    }
    
    // Second confirmation requiring event name to be typed
    const confirmText = prompt(`For safety, please type the name of the event to confirm deletion:\n\n"${selectedEvent.title}"`);
    
    // If user cancels or types incorrect name, abort
    if (!confirmText || confirmText.trim() !== selectedEvent.title) {
      toast.error('Bracket deletion canceled. The event name did not match.');
      return;
    }
    
    // No need to save scroll position here as we're deleting the entire bracket
    setLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Call the API endpoint to delete bracket
      const response = await fetch(`/api/events/${selectedEvent.id}/bracket`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete bracket: ${response.status}`);
      }
      
      // Clear the bracket data
      setBracketData(null);
      setSelectedMatch(null);
      
      // Update the event list to reflect that this event no longer has a bracket
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === selectedEvent.id 
            ? {...event, hasBracket: false, bracketCreatedAt: null, bracketUpdatedAt: null} 
            : event
        )
      );
      
      // Update the selected event
      setSelectedEvent(prev => ({...prev, hasBracket: false}));
      
      toast.success('Bracket deleted successfully!');
    } catch (error) {
      console.error('Error deleting bracket:', error);
      setError('Failed to delete bracket. Please try again.');
      toast.error('Failed to delete bracket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update handleGenerateBracket function to use toast instead of alerts
  const handleGenerateBracket = async () => {
    if (!selectedEvent) return;
    
    let shouldForceRegenerate = false;
    
    if (bracketData) {
      // More detailed warning for regenerating existing bracket
      if (!confirm(`⚠️ CAUTION: You are about to REGENERATE the bracket for "${selectedEvent.title}"\n\nThis will:\n• Reset ALL matches\n• Remove ALL winners\n• Reset the entire tournament structure\n• Randomly re-seed all participants\n\nAlready scheduled match times and locations will remain in the database but may apply to different matches.`)) {
        return;
      }
      
      // For regeneration, also ask user to type the word "REGENERATE" to confirm
      const confirmText = prompt(`To confirm that you want to REGENERATE the bracket for "${selectedEvent.title}", please type REGENERATE (all caps):`);
      
      if (!confirmText || confirmText !== "REGENERATE") {
        toast.error('Bracket regeneration canceled.');
        return;
      }
      
      shouldForceRegenerate = true;
    }
    
    setLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Call the API endpoint to generate bracket
      const response = await fetch(`/api/events/${selectedEvent.id}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        // Add body with force parameter when regenerating
        body: JSON.stringify({
          force: shouldForceRegenerate
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate bracket: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        setBracketData(data.bracket);
        setParticipants(data.participants || []);
        
        // Update the event list to reflect that this event now has a bracket
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.id === selectedEvent.id 
              ? {...event, hasBracket: true, bracketCreatedAt: new Date(), bracketUpdatedAt: new Date()} 
              : event
          )
        );
        
        // Update the selected event
        setSelectedEvent(prev => ({...prev, hasBracket: true}));
        
        toast.success(bracketData ? 'Bracket regenerated successfully!' : 'Bracket generated successfully!');
      }
    } catch (error) {
      console.error('Error generating bracket:', error);
      setError('Failed to generate bracket. Please try again.');
      toast.error('Failed to generate bracket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update the scroll position save/restore functions to target the correct element
  const saveScrollPosition = () => {
    const bracketSection = document.getElementById('bracketSection');
    const bracketMatchesList = document.getElementById('bracketMatchesList');
    
    if (bracketSection) {
      scrollPositionRef.current.bracketSection = { 
        x: bracketSection.scrollLeft, 
        y: bracketSection.scrollTop 
      };
    }
    
    if (bracketMatchesList) {
      scrollPositionRef.current.bracketMatchesList = { 
        x: bracketMatchesList.scrollLeft, 
        y: bracketMatchesList.scrollTop 
      };
    }
    
    scrollPositionRef.current.window = {
      x: window.scrollX,
      y: window.scrollY
    };
    
    console.log('Saved scroll positions:', scrollPositionRef.current);
  };

  // Improve restore function to handle scrolling more robustly
  const restoreScrollPosition = () => {
    // Use a longer timeout to ensure DOM is updated
    setTimeout(() => {
      try {
        const bracketSection = document.getElementById('bracketSection');
        const bracketMatchesList = document.getElementById('bracketMatchesList');
        
        if (bracketSection && scrollPositionRef.current.bracketSection) {
          console.log('Restoring bracketSection scroll to:', scrollPositionRef.current.bracketSection);
          bracketSection.scrollTo({
            left: scrollPositionRef.current.bracketSection.x,
            top: scrollPositionRef.current.bracketSection.y,
            behavior: 'auto'
          });
        }
        
        if (bracketMatchesList && scrollPositionRef.current.bracketMatchesList) {
          console.log('Restoring bracketMatchesList scroll to:', scrollPositionRef.current.bracketMatchesList);
          bracketMatchesList.scrollTo({
            left: scrollPositionRef.current.bracketMatchesList.x,
            top: scrollPositionRef.current.bracketMatchesList.y,
            behavior: 'auto'
          });
        }
        
        if (scrollPositionRef.current.window) {
          console.log('Restoring window scroll to:', scrollPositionRef.current.window);
          window.scrollTo({
            left: scrollPositionRef.current.window.x,
            top: scrollPositionRef.current.window.y,
            behavior: 'auto'
          });
        }
        
        console.log('Restored all scroll positions');
      } catch (err) {
        console.error('Error restoring scroll position:', err);
      }
    }, 300); // Longer delay to ensure DOM updates are complete
  };

  // Add console logging to better track match details throughout the lifecycle
  useEffect(() => {
    if (bracketData) {
      // Log a detailed breakdown of the first two matches from the first round to help debug
      try {
        const matchesSample = bracketData[0].slice(0, 2);
        console.log('DETAIL CHECK - Sample matches from bracketData:', matchesSample.map(match => ({
          id: match.id,
          hasScheduledTime: !!match.scheduledTime,
          scheduledTime: match.scheduledTime, 
          hasLocation: !!match.location,
          location: match.location,
          hasNotes: !!match.notes,
          notes: match.notes
        })));
      } catch (e) {
        console.error('Error logging sample matches:', e);
      }
    }
  }, [bracketData]);

  // Log the values of a specific match to debug why details aren't persisting
  useEffect(() => {
    if (bracketData && bracketData.length > 0 && bracketData[0].length > 0) {
      // Check if the first match has details to verify data structure
      const firstMatch = bracketData[0][0];
      console.log('DEBUG - First match in bracket:', { 
        id: firstMatch.id,
        scheduledTime: firstMatch.scheduledTime,
        hasScheduledTime: !!firstMatch.scheduledTime,
        location: firstMatch.location,
        hasLocation: !!firstMatch.location,
        notes: firstMatch.notes,
        hasNotes: !!firstMatch.notes,
        buttonType: (firstMatch.scheduledTime || firstMatch.location || firstMatch.notes) ? 'Edit Details' : 'Add Details'
      });
    }
  }, [bracketData]);

  // Render match item with explicit property checks
  const renderMatchItem = (match, isMatchReady) => {
    // Get participant names (including team members for duos)
    const participant1Name = getParticipantName(match.participant1Id);
    const participant2Name = getParticipantName(match.participant2Id);
    
    // Explicitly check for existence of details
    const hasDetails = Boolean(match.scheduledTime || match.location || match.notes);
    const buttonText = hasDetails ? 'Edit Details' : 'Add Details';
    
    return (
      <div 
        key={`match-${match.id}`} 
        className={`${styles.matchItem} ${match.winnerId ? styles.completed : ''} ${isMatchReady ? styles.ready : ''} ${selectedMatch?.id === match.id ? styles.selected : ''}`}
        onClick={() => handleMatchClick(match)}
      >
        <div className={styles.matchHeader}>
          <span className={styles.matchId}>Match #{match.id}</span>
          {match.scheduledTime && (
            <span className={styles.scheduledTime}>
              <FaClock /> {new Date(match.scheduledTime).toLocaleString([], {
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit'
              })}
            </span>
          )}
          {match.location && (
            <span className={styles.matchLocation}>
              @ {match.location}
            </span>
          )}
        </div>
        
        <div className={styles.matchParticipants}>
          <div className={`${styles.participant} ${match.winnerId === match.participant1Id ? styles.winner : ''}`}>
            {participant1Name}
            {match.winnerId === match.participant1Id && (
              <FaCrown className={styles.crownIcon} />
            )}
          </div>
          <div className={styles.versus}>vs</div>
          <div className={`${styles.participant} ${match.winnerId === match.participant2Id ? styles.winner : ''}`}>
            {participant2Name}
            {match.winnerId === match.participant2Id && (
              <FaCrown className={styles.crownIcon} />
            )}
          </div>
        </div>
        
        <div className={styles.matchActions}>
          <button className={styles.editButton} onClick={(e) => {
            e.stopPropagation();
            handleMatchClick(match);
          }}>
            <FaEdit /> {buttonText}
          </button>
          
          {match.notes && (
            <div className={styles.matchNotes}>
              <strong>Notes:</strong> {match.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminPageWrapper title="Tournament Bracket Manager">
      <Head>
        <title>Tournament Bracket Manager | Admin | Merrouch Gaming</title>
        <meta name="description" content="Manage tournament brackets for events" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      
      <div className={styles.bracketManagerContainer}>
        <div className={styles.eventsSection}>
          <h2>Events</h2>
          {loading && !selectedEvent ? (
            <div className={styles.loading}>Loading events...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <div className={styles.eventsList}>
              {events.length === 0 ? (
                <div className={styles.noEvents}>No events found</div>
              ) : (
                events.map(event => (
                  <div 
                    key={event.id} 
                    className={`${styles.eventCard} ${selectedEvent?.id === event.id ? styles.selected : ''} ${event.hasBracket ? styles.hasBracket : styles.noBracket}`}
                    onClick={() => handleEventSelect(event)}
                  >
                    <div className={styles.eventImageContainer}>
                      <div className={styles.eventImage}>
                        {event.image ? (
                          <img 
                            src={event.image} 
                            alt={event.title}
                            onError={(e) => {
                              // If image fails to load, replace with placeholder
                              console.log(`Image failed to load for event: ${event.title}`);
                              e.target.onerror = null;
                              e.target.parentNode.innerHTML = `<div class="${styles.noImage}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M152 64h144V24c0-13.25 10.7-24 24-24s24 10.75 24 24v40h40c35.3 0 64 28.65 64 64v320c0 35.3-28.7 64-64 64H64c-35.35 0-64-28.7-64-64V128c0-35.35 28.65-64 64-64h40V24c0-13.25 10.7-24 24-24s24 10.75 24 24v40zM48 448c0 8.8 7.16 16 16 16h320c8.8 0 16-7.2 16-16V240H48v208zm32-272H368V128c0-8.8-7.2-16-16-16H96c-8.84 0-16 7.2-16 16v48z"></path></svg></div>`;
                            }}
                          />
                        ) : (
                          <div className={styles.noImage}>
                            <FaCalendarAlt />
                          </div>
                        )}
                      </div>
                      <div className={styles.eventTitleOverlay}>
                        <h3 title={event.title}>
                          {event.title}
                        </h3>
                      </div>
                    </div>
                    <div className={styles.eventInfo}>
                      <div className={styles.eventMetaInfo}>
                        <div className={styles.eventMeta}>
                          <span className={styles.eventDate}>
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                          <span className={styles.eventType}>
                            {event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}
                          </span>
                        </div>
                        <div className={styles.bracketStatus}>
                          {event.hasBracket ? (
                            <>
                              <FaTrophy className={styles.bracketIcon} />
                              <span>Bracket Available</span>
                            </>
                          ) : (
                            <>
                              <span>No Bracket</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        <div className={styles.bracketSection} id="bracketSection">
          <div className={styles.bracketHeader}>
            <h2>Tournament Bracket</h2>
            {selectedEvent && (
              <div className={styles.bracketActions}>
                {bracketData && (
                  <>
                    <button 
                      className={styles.viewBracketButton}
                      onClick={handleViewPublicBracket}
                    >
                      <FaTrophy /> View Public Bracket
                    </button>
                    <button 
                      className={styles.resetTimesButton}
                      onClick={handleResetMatchTimes}
                      disabled={loading}
                      title="Clear all scheduled match times while preserving the bracket and match winners"
                    >
                      <FaClock /> Reset Times
                    </button>
                  </>
                )}
                <button 
                  className={styles.generateBracketButton}
                  onClick={handleGenerateBracket}
                  disabled={loading}
                  title={bracketData ? "Create a new bracket with randomly seeded participants (will reset all matches)" : "Create a new tournament bracket with the registered participants"}
                >
                  <FaTrophy /> {bracketData ? 'Regenerate Bracket' : 'Generate Bracket'}
                </button>
                {bracketData && (
                  <button 
                    className={styles.deleteBracketButton}
                    onClick={handleDeleteBracket}
                    disabled={loading}
                    title="WARNING: This will permanently delete the entire bracket"
                  >
                    <FaExclamationTriangle /> Delete Bracket
                  </button>
                )}
              </div>
            )}
          </div>
          
          {!selectedEvent ? (
            <div className={styles.noBracketSelected}>
              <p>Select an event to view or manage its bracket</p>
            </div>
          ) : loading ? (
            <div className={styles.loading}>Loading bracket data...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : !bracketData ? (
            <div className={styles.noBracket}>
              <p>No bracket available for this event.</p>
              <Link 
                href={`/events/${selectedEvent.id}/bracket`}
                className={sharedStyles.primaryButton}
              >
                Generate Bracket
              </Link>
            </div>
          ) : (
            <div className={styles.bracketMatchesList} id="bracketMatchesList">
              <div className={styles.roundControls}>
                <button 
                  className={styles.expandButton} 
                  onClick={() => toggleAllRounds(true)}
                  title="Expand all rounds"
                >
                  Expand All
                </button>
                <button 
                  className={styles.collapseButton} 
                  onClick={() => toggleAllRounds(false)}
                  title="Collapse all rounds"
                >
                  Collapse All
                </button>
              </div>
              
              {bracketData.map((round, roundIndex) => (
                <div key={`round-${roundIndex}`} className={styles.roundSection}>
                  <h3 
                    className={`${styles.roundTitle} ${styles.collapsible}`} 
                    onClick={() => toggleRound(roundIndex)}
                  >
                    <div className={styles.roundTitleContent}>
                      {roundIndex === 0 ? 'Round 1' : 
                       roundIndex === bracketData.length - 1 ? 'Final' : 
                       `Round ${roundIndex + 1}`}
                      
                      <div className={styles.roundSummary}>
                        {!expandedRounds[roundIndex] && (
                          <>
                            <span className={styles.matchCount}>
                              {round.length} matches
                            </span>
                            <span className={styles.completedCount}>
                              {round.filter(m => m.winnerId).length} completed
                            </span>
                            <span className={styles.readyCount}>
                              {round.filter(m => isMatchReadyToPlay(m)).length} ready
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={styles.collapseIcon}>
                      {expandedRounds[roundIndex] ? '▼' : '►'}
                    </span>
                  </h3>
                  
                  {expandedRounds[roundIndex] && (
                    <div className={styles.matchesList}>
                      {round.map((match) => {
                        // Determine if match is ready to be played
                        const isMatchReady = isMatchReadyToPlay(match);
                        
                        return renderMatchItem(match, isMatchReady);
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {renderMatchDetailsModal()}
      {renderParticipantSelectionModal()}
    </AdminPageWrapper>
  );
}
