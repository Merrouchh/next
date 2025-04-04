import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaCalendarAlt, FaTrophy, FaEdit, FaClock, FaExchangeAlt, FaCrown, FaRandom, FaCheck, FaTimes, FaExclamationTriangle, FaUndo } from 'react-icons/fa';
import styles from '../../../styles/AdminBracketManager.module.css';
import sharedStyles from '../../../styles/Shared.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import AdminPageWrapper from '../../../components/AdminPageWrapper';

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
  
  // Parse time with AM/PM awareness
  const parseTimeWithMeridiem = (timeStr) => {
    try {
      if (!timeStr) return null;
      
      // Check for 12-hour format or handle the datetime-local input
      const timePart = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
      
      // Parse the hours and minutes
      let hours, minutes;
      
      if (timePart.includes(':')) {
        [hours, minutes] = timePart.split(':').map(num => parseInt(num, 10));
      } else {
        return null;
      }
      
      // If we've already got the time in 24-hour format from the input
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
        // Set timestamp to force client-side cache bust
        const timestamp = Date.now();
        
        // Open the public bracket view in a new tab to see the changes
        window.open(`/events/${selectedEvent.id}/bracket?t=${timestamp}`, '_blank');
        
        // Update our local state
        setBracketData(data.bracket);
      }
      
      setSelectedMatch(null);
    } catch (error) {
      console.error('Error setting winner:', error);
      setError(error.message || 'Failed to set winner');
    } finally {
      setLoading(false);
    }
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
    
    // Format the scheduledTime for the input element
    const formattedTime = formatDatetimeForInput(match.scheduledTime);
    
    // Initialize matchDetails with existing data from the match
    setMatchDetails({
      scheduledTime: formattedTime,
      location: match.location || '',
      notes: match.notes || ''
    });
    
    // Check if this is a match with no players yet or TBD players
    const isEmptyMatch = (!match.participant1Id || match.participant1Name === 'TBD') && 
                          (!match.participant2Id || match.participant2Name === 'TBD');
    
    // If this match doesn't have a scheduled time yet, suggest the last time only if
    // appropriate conditions are met
    if (!match.scheduledTime) {
      console.log('No scheduled time, checking conditions...');
      console.log('Is empty match:', isEmptyMatch);
      console.log('Last scheduled time:', lastScheduledTime);
      
      if (!isEmptyMatch && lastScheduledTime) {
        // Apply the last scheduled time if players exist
        console.log('Using last scheduled time as template');
        setMatchDetails(prev => ({
          ...prev,
          scheduledTime: lastScheduledTime
        }));
      } else if (isEmptyMatch) {
        // For empty matches, don't auto-suggest a time
        console.log('Empty match, not suggesting time');
        setMatchDetails(prev => ({
          ...prev,
          scheduledTime: ''
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
        
        let enrichedBracket = [...data.bracket];
        
        // If we have additional match details, merge them into the bracket data
        if (!matchDetailsError && matchDetailsData && matchDetailsData.length > 0) {
          console.log('Enriching bracket with match details...');
          enrichedBracket = enrichedBracket.map(round => {
            return round.map(match => {
              const details = matchDetailsData.find(d => d.match_id === match.id);
              if (details) {
                console.log(`Found details for match ${match.id}:`, details);
                return {
                  ...match,
                  scheduledTime: details.scheduled_time || '',
                  location: details.location || '',
                  notes: details.notes || ''
                };
              }
              return match;
            });
          });
        } else {
          console.log('No match details found to enrich bracket data');
        }
        
        console.log('Setting enriched bracket data:', enrichedBracket);
        setBracketData(enrichedBracket);
        setParticipants(data.participants || []);
        
        // Set the first round to be expanded by default
        setExpandedRounds({ 0: true });
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

  // Save match details
  const handleSaveMatchDetails = async () => {
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
      
      let result;
      
      // Process the scheduled time explicitly to ensure it's exactly what the user intended
      let scheduledTime = matchDetails.scheduledTime || null;
      if (scheduledTime) {
        // Parse it first to verify the exact time components
        const parsedTime = parseTimeWithMeridiem(scheduledTime);
        console.log('Parsed time components:', parsedTime);
        
        if (parsedTime) {
          // Create a new date with these exact hour/minute values
          const date = new Date(scheduledTime);
          // Force the specific hours and minutes to make sure they're preserved
          date.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
          
          // Format for database (ISO string)
          scheduledTime = date.toISOString();
          console.log('Final scheduled time for database:', scheduledTime);
          console.log('Time in local format:', date.toString());
        }
      }
      
      // Prepare the data to save - use null for empty strings to ensure database consistency
      const dataToSave = {
        scheduled_time: scheduledTime,
        location: matchDetails.location || null,
        notes: matchDetails.notes || null,
        updated_at: new Date()
      };
      
      console.log('Data to save:', dataToSave);
      
      if (existingDetails) {
        // Update existing record
        result = await supabase
          .from('event_match_details')
          .update(dataToSave)
          .eq('id', existingDetails.id)
          .select();
      } else {
        // Insert new record
        result = await supabase
          .from('event_match_details')
          .insert([
            {
              event_id: selectedEvent.id,
              match_id: selectedMatch.id,
              ...dataToSave
            }
          ])
          .select();
      }
      
      console.log('Database result:', result);
      
      if (result.error) {
        console.error('Error in database operation:', result.error);
        throw result.error;
      }
      
      // Update the local state with the new details
      const updatedBracket = bracketData.map(round => {
        return round.map(match => {
          if (match.id === selectedMatch.id) {
            const updatedMatch = {
              ...match,
              scheduledTime: scheduledTime,
              location: matchDetails.location || null,
              notes: matchDetails.notes || null
            };
            console.log('Updated match in bracket:', updatedMatch);
            return updatedMatch;
          }
          return match;
        });
      });
      
      // Store the last scheduled time for next match suggestion (in the same format as input)
      if (scheduledTime) {
        console.log('Setting last scheduled time:', scheduledTime);
        // Store it in the input-compatible format
        setLastScheduledTime(scheduledTime);
      }
      
      console.log('Setting updated bracket data');
      setBracketData(updatedBracket);
      
      // Reload data from server to ensure consistency
      alert('Match details saved successfully!');
      setSelectedMatch(null);
      
      // After a short delay, refresh the bracket data from the server
      setTimeout(async () => {
        console.log('Refreshing bracket data after save');
        await fetchBracketData(selectedEvent.id);
      }, 500);
      
    } catch (error) {
      console.error('Error saving match details:', error);
      setError('Failed to save match details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Swap participants in a match
  const handleSwapParticipants = async () => {
    if (!selectedMatch || !selectedEvent || selectedMatch.winnerId) {
      alert("Cannot swap participants in a match that already has a winner.");
      return;
    }
    
    if (!selectedMatch.participant1Id || !selectedMatch.participant2Id) {
      alert("Cannot swap participants when one or both are not assigned yet.");
      return;
    }
    
    if (!confirm("Are you sure you want to swap the participants in this match?")) {
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Get the current bracket data from the database
      const { data: bracketData, error: bracketError } = await supabase
        .from('event_brackets')
        .select('matches, id')
        .eq('event_id', selectedEvent.id)
        .single();
      
      if (bracketError) throw bracketError;
      
      // Update the match by swapping participants
      const updatedMatches = bracketData.matches.map(round => {
        return round.map(match => {
          if (match.id === selectedMatch.id) {
            return {
              ...match,
              participant1Id: selectedMatch.participant2Id,
              participant1Name: selectedMatch.participant2Name,
              participant2Id: selectedMatch.participant1Id,
              participant2Name: selectedMatch.participant1Name
            };
          }
          return match;
        });
      });
      
      // Save the updated bracket back to the database
      const { error: updateError } = await supabase
        .from('event_brackets')
        .update({ 
          matches: updatedMatches,
          updated_at: new Date()
        })
        .eq('id', bracketData.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setBracketData(updatedMatches);
      setSelectedMatch(null);
      
      alert('Participants swapped successfully!');
    } catch (error) {
      console.error('Error swapping participants:', error);
      setError('Failed to swap participants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Add this new function to reset all match times
  const handleResetMatchTimes = async () => {
    if (!selectedEvent) return;
    
    if (!confirm(`Are you sure you want to reset all match times for "${selectedEvent.title}"? This will clear the scheduled time for all matches.`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Call the API endpoint to reset match times
      const response = await fetch(`/api/events/${selectedEvent.id}/match-details?action=resetTimes`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to reset match times: ${response.status}`);
      }
      
      await fetchBracketData(selectedEvent.id);
      alert('All match times have been reset successfully!');
    } catch (error) {
      console.error('Error resetting match times:', error);
      setError('Failed to reset match times. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update the handleDeleteBracket function to require typing the event name
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
      alert('Bracket deletion canceled. The event name did not match.');
      return;
    }
    
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
      
      alert('Bracket deleted successfully!');
    } catch (error) {
      console.error('Error deleting bracket:', error);
      setError('Failed to delete bracket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update the handleGenerateBracket function to pass force=true parameter
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
        alert('Bracket regeneration canceled.');
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
        
        alert(bracketData ? 'Bracket regenerated successfully!' : 'Bracket generated successfully!');
      }
    } catch (error) {
      console.error('Error generating bracket:', error);
      setError('Failed to generate bracket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to clear a match winner
  const handleClearWinner = async (matchId) => {
    if (!confirm('Are you sure you want to clear the winner for this match? This will undo all subsequent advancements.')) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      // Clear match winner through the API
      const response = await fetch(`/api/events/${selectedEvent.id}/bracket/clear-winner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          matchId: matchId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to clear winner: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        // Set timestamp to force client-side cache bust
        const timestamp = Date.now();
        
        // Open the public bracket view in a new tab to see the changes
        window.open(`/events/${selectedEvent.id}/bracket?t=${timestamp}`, '_blank');
        
        // Update our local state
        setBracketData(data.bracket);
        setSelectedMatch(null);
      }
    } catch (error) {
      console.error('Error clearing winner:', error);
      setError(error.message || 'Failed to clear match winner');
    } finally {
      setLoading(false);
    }
  };

  // Toggle round expansion
  const toggleRound = (roundIndex) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundIndex]: !prev[roundIndex]
    }));
  };

  // Toggle all rounds
  const toggleAllRounds = (expand = false) => {
    if (!bracketData) return;
    
    const newExpandedState = {};
    bracketData.forEach((_, index) => {
      newExpandedState[index] = expand;
    });
    
    setExpandedRounds(newExpandedState);
  };

  // Render match details modal
  const renderMatchDetailsModal = () => {
    if (!selectedMatch) return null;
    
    const participant1Name = getParticipantName(selectedMatch.participant1Id);
    const participant2Name = getParticipantName(selectedMatch.participant2Id);
    
    // Check if both participants are valid and neither is a bye
    const canSelectWinner = 
      selectedMatch.participant1Id && 
      selectedMatch.participant2Id && 
      participant1Name !== 'TBD' && 
      participant2Name !== 'TBD' &&
      participant1Name !== 'Bye' && 
      participant2Name !== 'Bye';
    
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
          <div className={styles.modalBody}>
            <div className={styles.matchParticipants}>
              <div className={`${styles.modalParticipant} ${selectedMatch.winnerId === selectedMatch.participant1Id ? styles.winner : ''}`}>
                {participant1Name}
                {selectedMatch.winnerId === selectedMatch.participant1Id && (
                  <FaCrown className={styles.crownIcon} />
                )}
              </div>
              <div className={styles.versus}>vs</div>
              <div className={`${styles.modalParticipant} ${selectedMatch.winnerId === selectedMatch.participant2Id ? styles.winner : ''}`}>
                {participant2Name}
                {selectedMatch.winnerId === selectedMatch.participant2Id && (
                  <FaCrown className={styles.crownIcon} />
                )}
              </div>
            </div>
            
            {canSelectWinner && !selectedMatch.winnerId && (
              <div className={styles.winnerSelection}>
                <h4>Select Winner</h4>
                <div className={styles.winnerButtons}>
                  <button 
                    className={styles.winnerButton}
                    onClick={() => handleSetWinner(selectedMatch.id, selectedMatch.participant1Id)}
                  >
                    {participant1Name} Wins
                  </button>
                  <button 
                    className={styles.winnerButton}
                    onClick={() => handleSetWinner(selectedMatch.id, selectedMatch.participant2Id)}
                  >
                    {participant2Name} Wins
                  </button>
                </div>
              </div>
            )}
            
            {selectedMatch.winnerId && (
              <div className={styles.winnerDisplay}>
                <h4>Winner</h4>
                <div className={styles.winnerName}>
                  {selectedMatch.winnerId === selectedMatch.participant1Id ? participant1Name : participant2Name}
                </div>
                <button 
                  className={styles.undoWinnerButton}
                  onClick={() => handleClearWinner(selectedMatch.id)}
                >
                  <FaUndo /> Undo Winner Selection
                </button>
              </div>
            )}
            
            {!selectedMatch.winnerId && isFirstRoundMatch() && (
              <div className={styles.opponentSwapSection}>
                <h4>Swap Participants</h4>
                <div className={styles.opponentButtons}>
                  <button 
                    className={styles.opponentButton} 
                    onClick={() => handleChangeOpponent('participant1')}
                    disabled={selectedMatch.participant1Id === 'bye'}
                  >
                    <FaExchangeAlt /> Swap {participant1Name}
                  </button>
                  <button 
                    className={styles.opponentButton} 
                    onClick={() => handleChangeOpponent('participant2')}
                    disabled={selectedMatch.participant2Id === 'bye'}
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
              {/* We need to handle datetime-local inputs carefully as browsers may default to noon */}
              <input 
                type="datetime-local" 
                value={matchDetails.scheduledTime} 
                onChange={(e) => {
                  // Handle empty string case specifically
                  const newValue = e.target.value;
                  console.log("Time changed to:", newValue);
                  
                  // Check if this might be a default 12:00 time
                  if (newValue) {
                    const date = new Date(newValue);
                    const hours = date.getHours();
                    const minutes = date.getMinutes();
                    
                    console.log("Time parsed as:", date.toString());
                    console.log("Hours detected:", hours, "Minutes:", minutes);
                    
                    // Specifically check for the browser issue with AM times
                    const inputHour = parseInt(newValue.split('T')[1].split(':')[0], 10);
                    console.log("Hour from input string:", inputHour);
                    
                    // If the browser parsed 11 AM as 12 PM (common issue)
                    if (inputHour === 11 && hours === 12) {
                      console.log("Detected AM to PM conversion issue, fixing...");
                      
                      // Explicitly set the hours to 11 (or whatever was in the input)
                      const [datePart, timePart] = newValue.split('T');
                      const adjustedValue = `${datePart}T${timePart}`;
                      console.log("Preserving exact input time:", adjustedValue);
                      
                      setMatchDetails({...matchDetails, scheduledTime: adjustedValue});
                      return;
                    }
                    
                    // If it's exactly 12:00, and user just selected a date (browser default behavior)
                    // we'll set it to a more reasonable time like 16:00 (4 PM)
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
                      
                      setMatchDetails({...matchDetails, scheduledTime: adjustedValue});
                      return;
                    }
                  }
                  
                  // If not a special case, just use the value as is
                  setMatchDetails({...matchDetails, scheduledTime: newValue});
                }}
                disabled={selectedMatch.winnerId}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Location</label>
              <input 
                type="text" 
                value={matchDetails.location} 
                onChange={(e) => setMatchDetails({...matchDetails, location: e.target.value})}
                placeholder="e.g., Station 3, Main Stage"
                disabled={selectedMatch.winnerId}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Notes</label>
              <textarea 
                value={matchDetails.notes} 
                onChange={(e) => setMatchDetails({...matchDetails, notes: e.target.value})}
                placeholder="Any additional information about this match"
                rows={3}
                disabled={selectedMatch.winnerId}
              />
            </div>
            
            {lastScheduledTime && !selectedMatch.scheduledTime && 
             ((selectedMatch.participant1Id && selectedMatch.participant1Name !== 'TBD') || 
              (selectedMatch.participant2Id && selectedMatch.participant2Name !== 'TBD')) && (
              <div className={styles.templateTimeInfo}>
                Using previous match time as template
              </div>
            )}
            
            <div className={styles.modalActions}>
              {!selectedMatch.winnerId && (
                <>
                  <button 
                    className={styles.swapButton}
                    onClick={handleSwapParticipants}
                    disabled={!selectedMatch.participant1Id || !selectedMatch.participant2Id}
                  >
                    <FaExchangeAlt /> Swap Participants
                  </button>
                  
                  <button 
                    className={styles.saveButton}
                    onClick={handleSaveMatchDetails}
                  >
                    Save Details
                  </button>
                </>
              )}
              
              <Link 
                href={`/events/${selectedEvent?.id}/bracket`}
                className={styles.viewBracketButton}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaTrophy /> View Public Bracket
              </Link>
            </div>
          </div>
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
        
        <div className={styles.bracketSection}>
          <div className={styles.bracketHeader}>
            <h2>Tournament Bracket</h2>
            {selectedEvent && (
              <div className={styles.bracketActions}>
                {bracketData && (
                  <>
                    <Link 
                      href={`/events/${selectedEvent?.id}/bracket`}
                      className={styles.viewBracketButton}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FaTrophy /> View Public Bracket
                    </Link>
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
            <div className={styles.bracketMatchesList}>
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
                              {round.filter(m => 
                                !m.winnerId && 
                                m.participant1Id && 
                                m.participant2Id && 
                                m.participant1Name !== 'TBD' && 
                                m.participant2Name !== 'TBD' &&
                                m.participant1Name !== 'Bye' && 
                                m.participant2Name !== 'Bye'
                              ).length} ready
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
                        const isMatchReady = !match.winnerId && 
                          match.participant1Id && match.participant2Id && 
                          match.participant1Name !== 'TBD' && match.participant2Name !== 'TBD' &&
                          match.participant1Name !== 'Bye' && match.participant2Name !== 'Bye';
                        
                        // Get participant names (including team members for duos)
                        const participant1Name = getParticipantName(match.participant1Id);
                        const participant2Name = getParticipantName(match.participant2Id);
                        
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
                                <FaEdit /> 
                                {match.scheduledTime ? 'Edit Details' : 'Add Details'}
                              </button>
                              
                              {match.notes && (
                                <div className={styles.matchNotes}>
                                  <strong>Notes:</strong> {match.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        );
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