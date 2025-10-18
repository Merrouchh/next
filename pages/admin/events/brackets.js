import { useState, useEffect, useRef, useCallback } from 'react';
// import { useRouter } from 'next/router'; // Removed unused import
import Head from 'next/head';
import Image from 'next/image';
import { FaCalendarAlt, FaTrophy, FaEdit, FaClock, FaExchangeAlt, FaCrown, FaTimes, FaUndo } from 'react-icons/fa';
import styles from '../../../styles/AdminBracketManager.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import AdminPageWrapper from '../../../components/AdminPageWrapper';
import DeleteBracketButton from '../../../components/bracket/DeleteBracketButton';
import { toast } from 'react-hot-toast';
import { getParticipantNameById, getParticipantDisplayName } from '../../../utils/participantUtils';
import { withServerSideAdmin } from '../../../utils/supabase/server-admin';

export default function BracketManager() {
  // const router = useRouter(); // Removed unused variable
  const { user, supabase } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true); // Add initial loading state
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
  const [expandedRounds, setExpandedRounds] = useState({});
  const [matchDetailsMap, setMatchDetailsMap] = useState({});
  const [scrollPosition, setScrollPosition] = useState(0); // Store scroll position
  const bracketSectionRef = useRef(null); // Reference to bracket section
  // Add state for tracking if all rounds are expanded
  const [allRoundsExpanded, setAllRoundsExpanded] = useState(false);
  const [copiedTime, setCopiedTime] = useState('');

  // Helper to save the current scroll position
  const saveScrollPosition = () => {
    if (bracketSectionRef.current) {
      const position = bracketSectionRef.current.scrollTop;
      console.log('Saving scroll position:', position);
      setScrollPosition(position);
    }
  };

  // Helper to restore the scroll position
  const restoreScrollPosition = useCallback(() => {
    if (bracketSectionRef.current && scrollPosition > 0) {
      console.log('Restoring scroll position:', scrollPosition);
      bracketSectionRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  // Effect to restore scroll position after bracket data updates
  useEffect(() => {
    restoreScrollPosition();
  }, [bracketData, restoreScrollPosition]);

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

  // Parse time with AM/PM awareness - updated to better handle mobile input - UNUSED
  /*
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
  */

  // Fetch bracket data for a specific event
  const fetchBracketData = useCallback(async (eventId) => {
    setLoading(true);
    console.log('Fetching bracket data for event:', eventId);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Fetch the bracket data
      const response = await fetch('/api/internal/admin/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'get-bracket',
          userId: user.id,
          eventId: eventId
        })
      });
      
      if (response.status === 404) {
        console.log('No bracket data found (404)');
        setBracketData(null);
        // Try to get participants even if no bracket exists
        try {
          const data = await response.json();
          console.log('404 response data:', data);
          console.log('Participants from 404 response:', data.participants);
          console.log('Participants count:', data.participants?.length || 0);
          setParticipants(data.participants || []);
        } catch (error) {
          console.log('Error parsing 404 response:', error);
          setParticipants([]);
        }
        setLoading(false);
        setInitialLoading(false); // Finished loading (even with 404)
        return null;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch bracket data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received bracket data from API:', data);
      
      if (!data || !data.bracket || (Array.isArray(data.bracket) && data.bracket.length === 0)) {
        console.log('No valid bracket data in response');
        setBracketData(null);
        // Set participants from API response even if no bracket exists
        setParticipants(data.participants || []);
        setLoading(false);
        setInitialLoading(false); // Finished loading (even without data)
        return null;
      }
      
      // Fetch ALL match details for this event from the database
      console.log('Fetching match details from database for event:', eventId);
      const { data: matchDetailsData, error: matchDetailsError } = await supabase
        .from('event_match_details')
        .select('*')
        .eq('event_id', eventId);
      
      if (matchDetailsError) {
        console.error('Error fetching match details:', matchDetailsError);
      } else {
        console.log(`Retrieved ${matchDetailsData?.length || 0} match details records from database`);
      }
      
      // Create a map of match details for faster lookup
      const detailsMap = {};
      if (matchDetailsData && matchDetailsData.length > 0) {
        matchDetailsData.forEach(detail => {
          if (detail && detail.match_id) {
            detailsMap[detail.match_id] = {
              scheduled_time: detail.scheduled_time,
              location: detail.location,
              notes: detail.notes
            };
          }
        });
      }
      
      console.log('Match details map created with keys:', Object.keys(detailsMap));
      
      // Create a deep copy of the bracket data to avoid reference issues
      let enrichedBracket = JSON.parse(JSON.stringify(data.bracket));
      
      // Ensure enrichedBracket is an array
      if (!Array.isArray(enrichedBracket)) {
        console.error('Bracket data is not an array:', enrichedBracket);
        throw new Error('Invalid bracket data structure');
      }
      
      // Apply the match details to the bracket data
      for (let r = 0; r < enrichedBracket.length; r++) {
        for (let m = 0; m < enrichedBracket[r].length; m++) {
          const match = enrichedBracket[r][m];
          const details = detailsMap[match.id];
          
          if (details) {
            console.log(`Applying details to match ${match.id}:`, details);
          }
          
          // Apply details if they exist, otherwise ensure empty strings
          enrichedBracket[r][m] = {
            ...match,
            scheduledTime: details?.scheduled_time || '',
            location: details?.location || '',
            notes: details?.notes || ''
          };
        }
      }
      
      // Initialize the matchDetailsMap from the enriched bracket
      const matchDetailsMapData = {};
      enrichedBracket.forEach(round => {
        round.forEach(match => {
          matchDetailsMapData[match.id] = {
            scheduledTime: match.scheduledTime || '',
            location: match.location || '',
            notes: match.notes || ''
          };
        });
      });
      
      console.log('Completed matchDetailsMap with entries:', Object.keys(matchDetailsMapData).length);
      
      // Sample of first match after enrichment for debugging
      if (enrichedBracket.length > 0 && enrichedBracket[0].length > 0) {
        const sampleMatch = enrichedBracket[0][0];
        console.log('Sample match after enrichment:', {
          id: sampleMatch.id,
          scheduledTime: sampleMatch.scheduledTime,
          location: sampleMatch.location,
          notes: sampleMatch.notes
        });
      }
      
      // Set state with the enriched data
      setBracketData(enrichedBracket);
      
      // Debug participants data structure
      if (data.participants && data.participants.length > 0) {
        console.log('Participant data sample:', {
          firstParticipant: data.participants[0],
          idType: typeof data.participants[0].id,
          idValue: data.participants[0].id
        });
      }
      
      setParticipants(data.participants || []);
      setMatchDetailsMap(matchDetailsMapData);
      
      // Initialize expanded rounds - ensure the first round is expanded by default
      const initialExpandedState = {};
      enrichedBracket.forEach((_, index) => {
        initialExpandedState[index] = index === 0;  // Expand only first round
      });
      setExpandedRounds(initialExpandedState);
      
      setLoading(false);
      setInitialLoading(false);
      
      return enrichedBracket;
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      setError(error.message || 'Failed to load bracket data');
      setLoading(false);
      setInitialLoading(false);
      return null;
    }
  }, [supabase, user.id]);

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
        
        console.log('Events query result:', { eventsData, eventsError });
        console.log('Raw events data:', eventsData);
        
        if (eventsError) throw eventsError;
        
        // Then, find which events have brackets
        const { data: bracketsData, error: bracketsError } = await supabase
          .from('event_brackets')
          .select('event_id, created_at, updated_at');
        
        console.log('Brackets query result:', { bracketsData, bracketsError });
        
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
        
        console.log('Final events array:', sortedEvents);
        console.log('Events with brackets:', sortedEvents.filter(e => e.hasBracket));
        console.log('Events without brackets:', sortedEvents.filter(e => !e.hasBracket));
        setEvents(sortedEvents);
        
        // Auto-select the most recent event with a bracket
        const eventWithBracket = sortedEvents.find(event => event.hasBracket);
        console.log('Event with bracket found:', eventWithBracket);
        if (eventWithBracket) {
          console.log('Auto-selecting most recent event with bracket:', eventWithBracket.title);
          setSelectedEvent(eventWithBracket);
          await fetchBracketData(eventWithBracket.id);  // Use await to ensure data is loaded
        } else {
          setInitialLoading(false); // No bracket to load, we can stop initial loading
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to load events. Please try again.');
        setInitialLoading(false); // Error occurred, stop initial loading
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [supabase, user, fetchBracketData]);

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
          console.log('Found participant for swap:', participant);
          console.log('Participant fields:', Object.keys(participant));
          if (participant) {
            // Normalize participant data for display
            const normalizedParticipant = {
              ...participant,
              name: participant.users?.username || 'Unknown',
              username: participant.users?.username || 'Unknown',
              email: participant.users?.email || '',
              matchId: match.id,
              position: 'participant1',
              opponentId: match.participant2Id,
              opponentName: match.participant2Name
            };
            swappableParticipants.push(normalizedParticipant);
          }
        }
        
        // Add participant 2 if it exists and isn't a bye
        if (match.participant2Id && match.participant2Id !== 'bye') {
          const participant = participants.find(p => p.id === match.participant2Id);
          if (participant) {
            // Normalize participant data for display
            const normalizedParticipant = {
              ...participant,
              name: participant.users?.username || 'Unknown',
              username: participant.users?.username || 'Unknown',
              email: participant.users?.email || '',
              matchId: match.id,
              position: 'participant2',
              opponentId: match.participant1Id,
              opponentName: match.participant1Name
            };
            swappableParticipants.push(normalizedParticipant);
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
          // Normalize participant data for display
          const normalizedParticipant = {
            ...participant,
            name: participant.users?.username || 'Unknown',
            username: participant.users?.username || 'Unknown',
            email: participant.users?.email || '',
            matchId: null,
            position: null,
            opponentId: null,
            opponentName: null,
            isUnassigned: true
          };
          swappableParticipants.push(normalizedParticipant);
        }
      });
      
      if (swappableParticipants.length === 0) {
        alert("No available participants to swap with. All participants are either in completed matches or are byes.");
        setLoading(false);
        return;
      }
      
      // Debug logging
      console.log('Participants array:', participants);
      console.log('Swappable participants:', swappableParticipants);
      console.log('Current participant to replace:', {
        position: participantPosition,
        currentId: currentParticipantId,
        currentName: participantPosition === 'participant1' 
          ? getParticipantName(selectedMatch.participant1Id)
          : getParticipantName(selectedMatch.participant2Id),
        matchId: selectedMatch.id
      });
      
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
    
    saveScrollPosition();
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
      const response = await fetch('/api/internal/admin/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update-match',
          userId: user.id,
          eventId: selectedEvent.id,
          bracketData: {
            matchId: matchId,
            winnerId: participantId
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update match: ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update match');
      }
      const data = result.result;
      
      if (data && data.bracket) {
        // Update our local state
        setBracketData(data.bracket);
        
        // Find the updated match in the bracket data
        const updatedMatch = findMatchInBracket(data.bracket, matchId);
        
        if (updatedMatch) {
          // Important: Create a complete copy of the match to ensure React detects the change
          const updatedMatchCopy = JSON.parse(JSON.stringify(updatedMatch));
          console.log('Updated match after setting winner:', updatedMatchCopy);
          
          // Update the selected match with the updated data
          setSelectedMatch(updatedMatchCopy);
          
          // Also refresh the participants list to ensure names are correctly mapped
          if (data.participants) {
            setParticipants(data.participants);
          }
        } else {
          // If we can't find the match, close the modal
          console.error('Could not find the updated match in bracket data');
          setSelectedMatch(null);
        }
        
        toast.success('Winner set successfully!');
      } else {
        throw new Error('Invalid response data');
      }
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
    
    saveScrollPosition();
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
      const response = await fetch('/api/internal/admin/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update-match',
          userId: user.id,
          eventId: selectedEvent.id,
          bracketData: {
            matchId: selectedMatch.id,
            clearWinner: true
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to clear match winner: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.success && data.result && data.result.bracket) {
        // Update our local state
        setBracketData(data.result.bracket);
        
        // Find the updated match in the bracket data
        const updatedMatch = findMatchInBracket(data.result.bracket, selectedMatch.id);
        
        if (updatedMatch) {
          // Important: Create a complete copy of the match to ensure React detects the change
          const updatedMatchCopy = JSON.parse(JSON.stringify(updatedMatch));
          console.log('Updated match after clearing winner:', updatedMatchCopy);
          
          // Ensure the winnerId is definitely cleared
          updatedMatchCopy.winnerId = null;
          
          // Update the selected match with the cleared winner
          setSelectedMatch(updatedMatchCopy);
          
          // Also refresh the participants list to ensure names are correctly mapped
          if (data.participants) {
            setParticipants(data.participants);
          }
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

  // Get participant name by ID - using centralized utility
  const getParticipantName = (participantId) => {
    if (!participantId) return 'TBD';
    
    // First try to get name from match data if available
    const matchWithParticipant = findMatchWithParticipant(participantId);
    if (matchWithParticipant) {
      if (String(matchWithParticipant.participant1Id) === String(participantId)) {
        return matchWithParticipant.participant1Name || 'Unknown';
      } else if (String(matchWithParticipant.participant2Id) === String(participantId)) {
        return matchWithParticipant.participant2Name || 'Unknown';
      }
    }
    
    // Fallback to centralized utility
    const name = getParticipantNameById(participantId, participants, selectedEvent?.team_type || 'solo', { format: 'text' });
    
    return name;
  };

  // Helper function to find a match that contains a given participant
  const findMatchWithParticipant = (participantId) => {
    if (!bracketData || !participantId) return null;
    
    for (const round of bracketData) {
      for (const match of round) {
        if (String(match.participant1Id) === String(participantId) || 
            String(match.participant2Id) === String(participantId)) {
          return match;
        }
      }
    }
    
    return null;
  };

  // Handle event selection
  const handleEventSelect = async (event) => {
    setSelectedEvent(event);
    
    if (event.hasBracket) {
      await fetchBracketData(event.id);
    } else {
      // Clear bracket data for events without brackets, but still fetch participants
      setBracketData(null);
      await fetchBracketData(event.id); // This will fetch participants even if no bracket exists
    }
  };

  // Handle match click for admin
  const handleMatchClick = (match) => {
    if (!match) return;
    
    setSelectedMatch(match);
    console.log('Match clicked:', match);
    
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
    
    // First check if we have details in our matchDetailsMap
    const detailsFromMap = matchDetailsMap[match.id];
    
    // Format the scheduledTime for the input element if it exists
    // Prioritize map data, then match data
    const scheduledTime = detailsFromMap?.scheduledTime || match.scheduledTime || '';
    const formattedTime = scheduledTime ? formatDatetimeForInput(scheduledTime) : '';
    const location = detailsFromMap?.location || match.location || '';
    const notes = detailsFromMap?.notes || match.notes || '';
    
    console.log('Setting match details to:', {
      scheduledTime: formattedTime,
      location: location,
      notes: notes
    });
    
    setMatchDetails({
      scheduledTime: formattedTime,
      location: location,
      notes: notes
    });
  };

  // Create a helper function to format and validate time input
  const validateAndFormatScheduledTime = (timeInput) => {
    if (!timeInput) return null;
    
    try {
      // Handle formats like "YYYY-MM-DD HH:MM" and convert to "YYYY-MM-DDThh:mm"
      let formattedInput = timeInput;
      if (timeInput.includes(' ') && !timeInput.includes('T')) {
        const [datePart, timePart] = timeInput.split(' ');
        if (datePart && timePart) {
          formattedInput = `${datePart}T${timePart}`;
        }
      }
      
      // Create a date object from the input
      const date = new Date(formattedInput);
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.error('Invalid date created from input');
        return null;
      }
      
      // Handle time part separately to avoid timezone issues
      const timeMatch = formattedInput.match(/(\d{1,2}):(\d{1,2})$/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        
        // Validate hours and minutes
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          // Set the exact time to avoid timezone issues
          date.setHours(hours, minutes, 0, 0);
        } else {
          console.error('Invalid hours or minutes', { hours, minutes });
          return null;
        }
      }
      
      // Return as ISO string for database storage
      return date.toISOString();
    } catch (error) {
      console.error('Error validating time input:', error);
      return null;
    }
  };

  // Create a helper function to handle datetime input changes
  const handleDatetimeInputChange = (value) => {
    // Empty value case
    if (!value) {
      setMatchDetails(prev => ({...prev, scheduledTime: ''}));
      return;
    }
    
    // Normalize format from "YYYY-MM-DD HH:MM" to "YYYY-MM-DDThh:mm" for consistency
    let formattedValue = value;
    if (value.includes(' ') && !value.includes('T')) {
      const [datePart, timePart] = value.split(' ');
      if (datePart && timePart) {
        formattedValue = `${datePart}T${timePart}`;
      }
    }
    
    try {
      // Parse the date to extract components
      const dateObj = new Date(formattedValue);
      
      // Handle possible timezone issues by extracting time directly from input
      if (formattedValue.includes('T')) {
        const [datePart, timePart] = formattedValue.split('T');
        const [inputHour, inputMinute] = timePart.split(':').map(num => parseInt(num, 10));
        
        // If parsed time doesn't match input time, create a corrected version
        if (!isNaN(inputHour) && !isNaN(inputMinute) && 
            (inputHour !== dateObj.getHours() || inputMinute !== dateObj.getMinutes())) {
          formattedValue = `${datePart}T${String(inputHour).padStart(2, '0')}:${String(inputMinute).padStart(2, '0')}`;
        }
      }
    } catch (e) {
      console.error("Error processing datetime input:", e);
    }
    
    // Update state with the formatted value
    setMatchDetails(prev => ({...prev, scheduledTime: formattedValue}));
  };

  // Make a helper function to fetch the bracket data after saving match details - UNUSED
  /*
  const refreshBracketAfterSave = async (eventId) => {
    console.log('Refreshing bracket data after save for event:', eventId);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const response = await fetch('/api/internal/admin/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'get-bracket',
          userId: user.id,
          eventId: eventId
        })
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
        
        // Ensure enrichedBracket is an array
        if (!Array.isArray(enrichedBracket)) {
          console.error('Bracket data is not an array during refresh:', enrichedBracket);
          throw new Error('Invalid bracket data structure during refresh');
        }
        
        // Create a map for faster lookups of match details
        const detailsMap = {};
        matchDetailsData.forEach(detail => {
          if (detail && detail.match_id) {
            detailsMap[detail.match_id] = detail;
          }
        });
        
        // Log details map for debugging
        console.log(`Found ${Object.keys(detailsMap).length} match details records in database`);
        
        // Apply details to each match in a way that preserves all detail fields
        for (let r = 0; r < enrichedBracket.length; r++) {
          for (let m = 0; m < enrichedBracket[r].length; m++) {
            const match = enrichedBracket[r][m];
            const details = detailsMap[match.id];
            
            if (details) {
              console.log(`Found details for match ${match.id} during refresh:`, details);
              
              // Keep original match properties but add the details
              // Important: Use empty strings instead of null for UI compatibility
              enrichedBracket[r][m] = {
                ...match,
                scheduledTime: details.scheduled_time || '',
                location: details.location || '',
                notes: details.notes || ''
              };
            } else {
              // For matches without details in the database, preserve what's in current state
              // Check if this match exists in current bracketData
              const currentMatch = findMatchInBracket(bracketData, match.id);
              
              if (currentMatch && (currentMatch.scheduledTime || currentMatch.location || currentMatch.notes)) {
                console.log(`Using existing details for match ${match.id} from current state`);
                
                enrichedBracket[r][m] = {
                  ...match,
                  scheduledTime: currentMatch.scheduledTime || '',
                  location: currentMatch.location || '',
                  notes: currentMatch.notes || ''
                };
              } else {
                // No details in db or current state
                enrichedBracket[r][m] = {
                  ...match,
                  scheduledTime: '',
                  location: '',
                  notes: ''
                };
              }
            }
          }
        }
        
        // Sample log to verify data before returning
        if (enrichedBracket[0] && enrichedBracket[0][0]) {
          console.log('SAMPLE: First match after enrichment:', {
            id: enrichedBracket[0][0].id,
            scheduledTime: enrichedBracket[0][0].scheduledTime,
            hasScheduledTime: !!enrichedBracket[0][0].scheduledTime,
            location: enrichedBracket[0][0].location,
            hasLocation: !!enrichedBracket[0][0].location,
            notes: enrichedBracket[0][0].notes,
            hasNotes: !!enrichedBracket[0][0].notes
          });
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
  */

  // Create a helper function to directly update bracket data without needing a refresh
  const updateMatchInBracketData = (matchId, updatedDetails) => {
    // Deep copy the current bracket data to avoid reference issues
    const updatedBracket = JSON.parse(JSON.stringify(bracketData));
    
    // Find the match and update it
    let matchFound = false;
    
    for (let r = 0; r < updatedBracket.length; r++) {
      for (let m = 0; m < updatedBracket[r].length; m++) {
        if (updatedBracket[r][m].id === matchId) {
          console.log(`Directly updating match ${matchId} in state with details:`, updatedDetails);
          
          // Update only the detail fields
          updatedBracket[r][m] = {
            ...updatedBracket[r][m],
            scheduledTime: updatedDetails.scheduledTime || '',
            location: updatedDetails.location || '',
            notes: updatedDetails.notes || ''
          };
          
          matchFound = true;
          break;
        }
      }
      if (matchFound) break;
    }
    
    return updatedBracket;
  };

  // Update handleSaveMatchDetails with scroll preservation
  const handleSaveMatchDetails = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!selectedMatch || !selectedEvent) return;
    
    saveScrollPosition();
    setLoading(true);
    setError(null);
    
    try {
      console.log('Saving match details:', matchDetails);
      
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
      
      console.log('Data to save to database:', dataToSave);
      
      // Check if match details already exist for this match
      const { data: existingDetails, error: checkError } = await supabase
        .from('event_match_details')
        .select('id')
        .eq('event_id', selectedEvent.id)
        .eq('match_id', selectedMatch.id)
        .single();
      
      console.log('Existing details:', existingDetails);
      if (checkError) console.log('Check error:', checkError);
      
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
      
      // Immediately update matchDetailsMap to reflect changes without needing a full refresh
      setMatchDetailsMap(prevMap => ({
        ...prevMap,
        [selectedMatch.id]: {
          scheduledTime: scheduledTime || '',
          location: location || '',
          notes: notes || ''
        }
      }));
      
      // Update local bracket data with these changes
      const updatedBracket = updateMatchInBracketData(selectedMatch.id, {
        scheduledTime: scheduledTime || '',
        location: location || '',
        notes: notes || ''
      });
      
      if (updatedBracket) {
        setBracketData(updatedBracket);
      }
      
      // Success message
      toast.success('Match details saved successfully!');
      
      // Clear the selected match
      setSelectedMatch(null);
      
      setLoading(false);
    } catch (error) {
      console.error('Error saving match details:', error);
      setError('Failed to save match details. Please try again.');
      toast.error('Failed to save match details. Please try again.');
      setLoading(false);
    }
  };

  // Update handleSwapParticipants to better handle participant names
  const handleSwapParticipants = async (matchId) => {
    saveScrollPosition();
    setLoading(true);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch('/api/internal/admin/match-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'swap-participants',
          userId: user.id,
          eventId: selectedEvent.id,
          matchDetailsData: { matchId: matchId }
        })
      });

      if (response.ok) {
        // Fetch fresh participant data first to ensure we have the latest names
        const participantsResponse = await fetch('/api/internal/admin/match-details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'get-participants',
            userId: user.id,
            eventId: selectedEvent.id
          })
        });
        
        if (participantsResponse.ok) {
          const participantsResult = await participantsResponse.json();
          if (participantsResult.success && participantsResult.result && participantsResult.result.participants) {
            setParticipants(participantsResult.result.participants);
          }
        }
        
        // Now refresh bracket data to get updated match info
        const updatedBracketData = await fetchBracketData(selectedEvent.id);
        toast.success('Participants swapped successfully');
        
        // If we have the updated bracket data and the modal is open with this match
        if (updatedBracketData && selectedMatch && selectedMatch.id === matchId) {
          // Find the updated match in the refreshed bracket data
          const updatedMatch = findMatchInBracket(updatedBracketData, matchId);
          
          if (updatedMatch) {
            // Create a deep copy to ensure React detects the change
            const updatedMatchCopy = JSON.parse(JSON.stringify(updatedMatch));
            console.log('Updated match in the modal after swapping:', updatedMatchCopy);
            
            // Update the match in the modal with the new participant info
            setSelectedMatch(updatedMatchCopy);
            
            // Also update the match details state with the current values
            setMatchDetails(prevDetails => ({
              ...prevDetails,
              // We keep the existing scheduled time, location, and notes
              // but reflect the updated participant information from the API
            }));
          } else {
            console.error('Failed to find updated match in bracket data after swap');
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(`Failed to swap participants: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error swapping participants:', error);
      toast.error(`Error swapping participants: ${error.message}`);
    } finally {
      setLoading(false);
      restoreScrollPosition();
    }
  };

  // Toggle round expansion with scroll position preservation
  const toggleRound = (roundIndex) => {
    saveScrollPosition();
    setExpandedRounds(prev => ({
      ...prev,
      [roundIndex]: !prev[roundIndex]
    }));
  };

  // Toggle all rounds with scroll position preservation
  const toggleAllRounds = (expand) => {
    if (!bracketData) return;
    
    saveScrollPosition();
    
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
    setAllRoundsExpanded(expand);
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
    // Open the public bracket view in a new tab without timestamp
    window.open(`/events/${selectedEvent?.id}/bracket`, '_blank');
  };

  // Render match details modal
  const renderMatchDetailsModal = () => {
    if (!selectedMatch) return null;
    
    // Get participant names
    const participant1Name = getParticipantName(selectedMatch.participant1Id);
    const participant2Name = getParticipantName(selectedMatch.participant2Id);
    
    // Check if both participants are valid and neither is a bye
    const canSelectWinner = isMatchReadyToPlay(selectedMatch);
    
    // Explicitly check if match has a winner to prevent UI issues
    const hasWinner = Boolean(selectedMatch.winnerId);
    
    // Log current match details and winner state for debugging
    console.log('Rendering modal with match details:', {
      matchId: selectedMatch.id,
      winnerId: selectedMatch.winnerId,
      hasWinner: hasWinner,
      participant1: {
        id: selectedMatch.participant1Id,
        name: participant1Name
      },
      participant2: {
        id: selectedMatch.participant2Id,
        name: participant2Name
      },
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="datetime-local" 
                  value={matchDetails.scheduledTime} 
                  onChange={(e) => handleDatetimeInputChange(e.target.value)}
                  pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}"
                  step="60"
                />
                <button type="button" onClick={handleCopyTime} title="Copy this time">
                  Copy
                </button>
                <button 
                  type="button" 
                  onClick={handlePasteTime} 
                  disabled={!copiedTime}
                  title="Paste copied time"
                >
                  Paste
                </button>
              </div>
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
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Notes</label>
              <textarea 
                value={matchDetails.notes || ''} 
                onChange={(e) => setMatchDetails({...matchDetails, notes: e.target.value})}
                placeholder="Any additional information about this match"
                rows={3}
              />
            </div>
            
            <div className={styles.modalActions}>
              {!hasWinner && (
                <button 
                  className={styles.swapButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedMatch) {
                      handleSwapParticipants(selectedMatch.id);
                    }
                  }}
                  disabled={!selectedMatch || !selectedMatch.participant1Id || !selectedMatch.participant2Id || hasWinner}
                  type="button"
                >
                  <FaExchangeAlt /> Swap Participants
                </button>
              )}
              
              <button 
                type="submit"
                className={styles.saveButton}
              >
                Save Details
              </button>
              
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
                  const displayName = getParticipantDisplayName(participant, selectedEvent?.team_type || 'solo', { format: 'text' });
                    
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

  // Update handleResetMatchTimes with scroll preservation
  const handleResetMatchTimes = async () => {
    if (!selectedEvent) return;
    
    saveScrollPosition();
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/events/${selectedEvent.id}/match-details?action=resetTimes`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
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
    }
  };

  // Simplified handleDeleteBracket - confirmation is now handled by the shared component
  const handleDeleteBracket = async () => {
    if (!selectedEvent) return;
    
    setLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Call the API endpoint to delete bracket
      const response = await fetch('/api/internal/admin/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete-match',
          userId: user.id,
          eventId: selectedEvent.id,
          bracketData: {}
        })
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
      throw error; // Re-throw so the shared component can handle it
    } finally {
      setLoading(false);
    }
  };

  // Update handleGenerateBracket function to use toast instead of alerts
  const handleGenerateBracket = async () => {
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }
    
    let shouldForceRegenerate = false;
    
    if (bracketData) {
      // More detailed warning for regenerating existing bracket
      if (!confirm(`⚠️ CAUTION: You are about to REGENERATE the bracket for "${selectedEvent.title}"\n\nThis will:\n• Reset ALL matches\n• Remove ALL winners\n• Reset the entire tournament structure\n• Randomly re-seed all participants\n\nAlready scheduled match times and locations will remain in the database but may apply to different matches.`)) {
        return;
      }
      
      // For regeneration, also ask user to type the word "REGENERATE" to confirm
      const confirmText = prompt(`To confirm that you want to REGENERATE the bracket for "${selectedEvent.title}", please type REGENERATE (all caps):`);
      
      if (!confirmText || confirmText.trim().toUpperCase() !== "REGENERATE") {
        console.log('Regenerate confirmation failed:', {
          userInput: confirmText,
          expected: "REGENERATE",
          userInputTrimmed: confirmText?.trim(),
          userInputUpper: confirmText?.trim().toUpperCase()
        });
        toast.error('Bracket regeneration canceled. Please type exactly: REGENERATE');
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
      const response = await fetch('/api/internal/admin/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: bracketData ? 'regenerate' : 'generate',
          userId: user.id,
          eventId: selectedEvent.id,
          bracketData: {
            force: shouldForceRegenerate
          }
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

  // Add this effect to initialize the matchDetailsMap whenever bracketData is loaded
  useEffect(() => {
    if (bracketData) {
      // Create a map of match details for caching
      const detailsMap = {};
      
      // Extract all match details from bracket data
      bracketData.forEach(round => {
        round.forEach(match => {
          // Always store match details in the map, even if empty
          detailsMap[match.id] = {
            scheduledTime: match.scheduledTime || '',
            location: match.location || '',
            notes: match.notes || ''
          };
        });
      });
      
      console.log('Initialized matchDetailsMap from bracketData with', Object.keys(detailsMap).length, 'entries');
      setMatchDetailsMap(detailsMap);
    }
  }, [bracketData]);

  // Update the renderMatchItem function to add an id to each match div
  const renderMatchItem = (match, isMatchReady) => {
    // Get participant names (including team members for duos)
    const participant1Name = getParticipantName(match.participant1Id);
    const participant2Name = getParticipantName(match.participant2Id);
    
    // Get details from our cached map if they exist, otherwise use the match details
    const matchDetailsFromMap = matchDetailsMap[match.id];
    
    // Always prioritize map data, but fall back to direct match data
    const scheduledTimeToShow = matchDetailsFromMap?.scheduledTime || match.scheduledTime || '';
    const locationToShow = matchDetailsFromMap?.location || match.location || '';
    const notesToShow = matchDetailsFromMap?.notes || match.notes || '';
    
    // Log match details to help debug
    if (match.winnerId) {
      console.log(`Match ${match.id} with winner details:`, {
        winnerId: match.winnerId,
        hasScheduledTime: !!scheduledTimeToShow,
        scheduledTime: scheduledTimeToShow,
        hasLocation: !!locationToShow,
        location: locationToShow,
        hasNotes: !!notesToShow, 
        notes: notesToShow
      });
    }
    
    // Always show "Edit Details" for consistency
    const buttonText = 'Edit Details';
    
    // Format the date display with additional debugging
    let formattedDate = '';
    if (scheduledTimeToShow) {
      try {
        const date = new Date(scheduledTimeToShow);
        
        if (!isNaN(date.getTime())) {
          formattedDate = date.toLocaleString([], {
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
          });
        } else {
          console.warn(`Invalid date for match ${match.id}:`, scheduledTimeToShow);
          formattedDate = 'Invalid date';
        }
      } catch (e) {
        console.error('Error formatting date:', e, scheduledTimeToShow);
        formattedDate = 'Invalid date';
      }
    }
    
    return (
      <div 
        key={`match-${match.id}`} 
        className={`${styles.matchItem} ${match.winnerId ? styles.completed : ''} ${isMatchReady ? styles.ready : ''} ${selectedMatch?.id === match.id ? styles.selected : ''}`}
        onClick={() => handleMatchClick(match)}
      >
        <div className={styles.matchHeader}>
          <span className={styles.matchId}>Match #{match.id}</span>
          {scheduledTimeToShow && (
            <span className={styles.scheduledTime}>
              <FaClock /> {formattedDate}
            </span>
          )}
          {locationToShow && (
            <span className={styles.matchLocation}>
              @ {locationToShow}
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
          
          {notesToShow && (
            <div className={styles.matchNotes}>
              <strong>Notes:</strong> {notesToShow}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Update match details whenever selectedMatch changes
  useEffect(() => {
    if (selectedMatch) {
      const detailsFromMap = matchDetailsMap[selectedMatch.id];
      
      // Format the scheduledTime for the input element if it exists
      const scheduledTime = detailsFromMap?.scheduledTime || selectedMatch.scheduledTime || '';
      const formattedTime = scheduledTime ? formatDatetimeForInput(scheduledTime) : '';
      const location = detailsFromMap?.location || selectedMatch.location || '';
      const notes = detailsFromMap?.notes || selectedMatch.notes || '';
      
      console.log('Updating match details from selectedMatch change:', {
        matchId: selectedMatch.id,
        scheduledTime: formattedTime,
        location: location,
        notes: notes
      });
      
      setMatchDetails({
        scheduledTime: formattedTime,
        location: location,
        notes: notes
      });
    }
  }, [selectedMatch, matchDetailsMap]);

  const handleCopyTime = () => {
    if (matchDetails.scheduledTime) {
      setCopiedTime(matchDetails.scheduledTime);
      toast.success('Match time copied!');
    } else {
      toast.error('No time to copy!');
    }
  };

  const handlePasteTime = () => {
    if (copiedTime) {
      setMatchDetails(prev => ({
        ...prev,
        scheduledTime: copiedTime
      }));
      toast.success('Match time pasted!');
    }
  };

  return (
    <AdminPageWrapper title="Tournament Bracket Manager">
      <Head>
        <title>Tournament Bracket Manager | Admin | Merrouch Gaming</title>
        <meta name="description" content="Manage tournament brackets for events" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      
      {console.log('Render state:', { initialLoading, loading, error, eventsLength: events.length })}
      {initialLoading ? (
        <div className={styles.fullPageLoading}>
          <div className={styles.loadingSpinner}></div>
          <div>Loading bracket manager...</div>
        </div>
      ) : (
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
                            <Image 
                              src={event.image} 
                              alt={event.title}
                              width={300}
                              height={200}
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
          
          <div 
            className={styles.bracketSection} 
            id="bracketSection"
            ref={bracketSectionRef}
          >
            <div className={styles.bracketHeader}>
              <h2>Tournament Bracket</h2>
              {selectedEvent && !loading && (
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
                    disabled={loading || !selectedEvent}
                    title={bracketData ? "Create a new bracket with randomly seeded participants (will reset all matches)" : "Create a new tournament bracket with the registered participants"}
                  >
                    <FaTrophy /> {bracketData ? 'Regenerate Bracket' : 'Generate Bracket'}
                  </button>
                  {bracketData && (
                    <DeleteBracketButton
                      onDelete={handleDeleteBracket}
                      eventTitle={selectedEvent?.title || 'Tournament'}
                      disabled={loading}
                      variant="admin"
                    />
                  )}
                </div>
              )}
              {selectedEvent && loading && (
                <div className={styles.loadingActions}>
                  <span>Loading bracket actions...</span>
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
            ) : (() => {
              console.log('Bracket display condition check:', { 
                bracketData, 
                bracketDataIsNull: bracketData === null, 
                bracketDataIsUndefined: bracketData === undefined,
                bracketDataLength: bracketData?.length,
                participantsLength: participants.length 
              });
              return !bracketData;
            })() ? (
              <div className={styles.noBracket}>
                <div className={styles.noBracketContent}>
                  <FaTrophy className={styles.noBracketIcon} />
                  <h3>No Tournament Bracket</h3>
                  <p>This event has <strong>{participants.length} participants</strong> but no bracket has been generated yet.</p>
                  <p>Click the button below to create a tournament bracket and start managing matches.</p>
                  <button 
                    className={styles.createBracketButton}
                    onClick={handleGenerateBracket}
                    disabled={loading || !selectedEvent}
                  >
                    <FaTrophy /> Generate Tournament Bracket
                  </button>
                  {participants.length === 0 && (
                    <p className={styles.warningText}>
                      ⚠️ No participants registered yet. Participants need to register before generating a bracket.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.bracketMatchesList} id="bracketMatchesList">
                <div className={styles.roundControls}>
                  <button 
                    className={styles.toggleRoundsButton} 
                    onClick={() => toggleAllRounds(!allRoundsExpanded)}
                    title={allRoundsExpanded ? "Collapse all rounds" : "Expand all rounds"}
                  >
                    {allRoundsExpanded ? "Collapse All" : "Expand All"}
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
      )}
      
      {renderMatchDetailsModal()}
      {renderParticipantSelectionModal()}
    </AdminPageWrapper>
  );
}

// 🛡️ SERVER-SIDE PROTECTION: Require admin privileges
export const getServerSideProps = withServerSideAdmin(true);

