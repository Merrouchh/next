import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import styles from '../../../../styles/AdminEventRegistrations.module.css';
import { useAuth } from '../../../../contexts/AuthContext';
import AdminPageWrapper from '@/components/AdminPageWrapper';
import { withServerSideAdmin } from '../../../../utils/supabase/server-admin';

// Format date for display - moved to a utility function outside component
const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Format timestamp for display - moved to a utility function outside component
const formatTimestamp = (timestamp, isMobile = false) => {
  try {
    const date = new Date(timestamp);
    if (isMobile) {
      return date.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return timestamp;
  }
};

// Truncate email for mobile display - UNUSED
/*
const truncateEmail = (email, isMobile) => {
  if (!email) return 'No email available';
  
  // Always return the full email
  return email;
};
*/

// Generate a color based on a string (username)
const generateColorFromString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
};

// Get initials from a name (up to 2 characters)
const getInitials = (name) => {
  if (!name) return 'U';
  
  const parts = name.split(/[\s-_]+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  } else if (parts.length > 1) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  
  return name.charAt(0).toUpperCase();
};

// Add a function to generate unique colors for each team
const generateTeamColor = (teamId) => {
  // Use a set of predefined colors that look good and are distinct
  const teamColors = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Teal
    '#d35400', // Dark Orange
    '#c0392b', // Dark Red
    '#8e44ad', // Dark Purple
    '#16a085', // Dark Teal
  ];
  
  // Use the teamId to select a color from the array
  const colorIndex = Math.abs(hashString(teamId)) % teamColors.length;
  return teamColors[colorIndex];
};

// Simple hash function for strings
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};


export default function EventRegistrations() {
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { id } = router.query;
  const { user, supabase } = useAuth();

  // Check if mobile on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkIfMobile = () => {
        setIsMobile(window.innerWidth <= 768);
      };
      
      checkIfMobile();
      window.addEventListener('resize', checkIfMobile);
      
      return () => {
        window.removeEventListener('resize', checkIfMobile);
      };
    }
  }, []);

  // Redirect if not admin
  useEffect(() => {
    if (user && !user.isAdmin && typeof window !== 'undefined') {
      router.replace('/events');
    }
  }, [user, router]);

  // Fetch event details and registrations
  useEffect(() => {
    const fetchEventRegistrations = async () => {
      if (!id || !user?.isAdmin) return;
      
      setLoading(true);
      
      try {
        // Get the session for authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          throw new Error('Authentication token not available');
        }
        
        // Fetch event details
        const eventResponse = await fetch('/api/internal/admin/event-registrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'get-event',
            userId: user.id,
            eventId: id
          })
        });
        
        if (!eventResponse.ok) {
          throw new Error('Failed to fetch event details');
        }
        
        const eventResult = await eventResponse.json();
        if (!eventResult.success) {
          throw new Error(eventResult.error || 'Failed to fetch event details');
        }
        const eventData = eventResult.result;
        console.log('Event data received:', JSON.stringify(eventData, null, 2));
        
        // Make sure we're using the correct property from the API response
        // The API returns { event: {...} } but we need to extract the event object
        setEvent(eventData.event || eventData);
        
        // Fetch registrations
        const registrationsResponse = await fetch('/api/internal/admin/event-registrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'get-registrations',
            userId: user.id,
            eventId: id
          })
        });
        
        if (!registrationsResponse.ok) {
          throw new Error('Failed to fetch registrations');
        }
        
        const registrationsResult = await registrationsResponse.json();
        if (!registrationsResult.success) {
          throw new Error(registrationsResult.error || 'Failed to fetch registrations');
        }
        const registrationsData = registrationsResult.result;
        console.log('Registration data received:', JSON.stringify(registrationsData, null, 2));
        
        if (registrationsData && registrationsData.length > 0) {
          console.log('First registration:', JSON.stringify(registrationsData[0], null, 2));
          
          // Check if team members have email
          registrationsData.forEach(reg => {
            if (reg.teamMembers && reg.teamMembers.length > 0) {
              console.log(`Team members for ${reg.username}:`, JSON.stringify(reg.teamMembers, null, 2));
              reg.teamMembers.forEach((member, index) => {
                console.log(`Team member ${index} email:`, member.email);
              });
            }
          });
          
          // Team members are now provided by the API, no client-side processing needed
        }
        
        setRegistrations(registrationsData || []);
      } catch (error) {
        console.error('Error fetching event registrations:', error);
        toast.error('Failed to load registrations');
        
        // Fallback to sample data for development
        if (process.env.NODE_ENV === 'development') {
          const sampleEvent = {
            id: parseInt(id),
            title: 'Sample Event',
            date: '2025-04-15',
            time: '18:00',
            location: 'Online',
            game: 'Fortnite',
            status: 'Upcoming',
            registration_limit: 50,
            registered_count: 3
          };
          
          const sampleRegistrations = [
            {
              id: 1,
              user_id: 'user1',
              event_id: parseInt(id),
              created_at: '2025-03-01T10:00:00Z',
              user: {
                id: 'user1',
                email: 'user1@example.com',
                full_name: 'John Doe',
                avatar_url: null
              }
            },
            {
              id: 2,
              user_id: 'user2',
              event_id: parseInt(id),
              created_at: '2025-03-02T11:30:00Z',
              user: {
                id: 'user2',
                email: 'user2@example.com',
                full_name: 'Jane Smith',
                avatar_url: null
              }
            },
            {
              id: 3,
              user_id: 'user3',
              event_id: parseInt(id),
              created_at: '2025-03-03T09:15:00Z',
              user: {
                id: 'user3',
                email: 'user3@example.com',
                full_name: 'Alex Johnson',
                avatar_url: null
              }
            }
          ];
          
          setEvent(sampleEvent);
          setRegistrations(sampleRegistrations);
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?.isAdmin && id) {
      fetchEventRegistrations();
    }
    // Only re-fetch when id, user.id, or isAdmin status changes, not when user object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, user?.isAdmin, supabase]);
  
  // Export registrations to CSV
  const exportToCSV = async () => {
    if (!event || !registrations.length) return;
    
    setExportLoading(true);
    
    try {
      // Create CSV content
      const headers = ['Name', 'Email', 'Phone', 'Registration Date', 'Status', 'Notes'];
      const csvContent = [
        headers.join(','),
        ...registrations.map(reg => [
          `"${reg.username || reg.user.username || 'Unknown'}"`,
          `"${reg.user.email || 'No email'}"`,
          `"${reg.user.phone || 'No phone'}"`,
          `"${reg.registration_date_formatted || formatTimestamp(reg.registration_date, isMobile)}"`,
          `"${reg.status || 'registered'}"`,
          `"${reg.notes || ''}"`
        ].join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_registrations.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Registrations exported successfully');
    } catch (error) {
      console.error('Error exporting registrations:', error);
      toast.error('Failed to export registrations');
    } finally {
      setExportLoading(false);
    }
  };
  
  // Remove registration
  const removeRegistration = async (registrationId, userName) => {
    if (!confirm(`Are you sure you want to remove ${userName}'s registration?`)) {
      return;
    }
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Authentication token not available');
      }
      
      const response = await fetch('/api/internal/admin/event-registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete-registration',
          userId: user.id,
          eventId: event.id,
          registrationData: { 
            registrationId,
            eventId: id
          }
        })
      });
      
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.message || 'Failed to remove registration');
      }
      
      // Update local state
      setRegistrations(prev => prev.filter(reg => reg.id !== registrationId));
      
      // Update event count
      if (event) {
        setEvent(prev => ({
          ...prev,
          registered_count: Math.max(0, (prev.registered_count || 0) - 1)
        }));
      }
      
      toast.success(`${userName}'s registration has been removed`);
    } catch (error) {
      console.error('Error removing registration:', error);
      toast.error(error.message || 'Failed to remove registration');
    }
  };

  // If not admin, don't render anything
  if (!user?.isAdmin) {
    return null;
  }

  return (
    <AdminPageWrapper>
      <Head>
        <title>{event ? `${event.title} Registrations | MerrouchGaming` : 'Event Registrations | MerrouchGaming'}</title>
        <meta name="description" content="Manage event registrations" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.breadcrumbs}>
            <Link href="/admin/events" className={styles.breadcrumbLink}>
              Events
            </Link>
            <span className={styles.breadcrumbSeparator}>/</span>
            {event && (
              <Link href={`/events/${id}`} className={styles.breadcrumbLink}>
                {event.title}
              </Link>
            )}
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Registrations</span>
          </div>
          
          <div className={styles.actions}>
            <button 
              className={styles.exportButton}
              onClick={exportToCSV}
              disabled={exportLoading || !registrations.length}
            >
              {exportLoading ? 'Exporting...' : 'Export to CSV'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <p>Loading registrations...</p>
          </div>
        ) : !event ? (
          <div className={styles.notFoundContainer}>
            <h2>Event Not Found</h2>
            <p>The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Link href="/admin/events" className={styles.backButton}>
              Return to Events
            </Link>
          </div>
        ) : (
          <div className={styles.content}>
            <div className={styles.eventSummary}>
              <h1 className={styles.eventTitle}>{event.title}</h1>
              <div className={styles.eventMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Date:</span>
                  <span className={styles.metaValue}>{formatDate(event.date)}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Time:</span>
                  <span className={styles.metaValue}>{event.time}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Status:</span>
                  <span className={`${styles.metaValue} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
                    {event.status}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Team Type:</span>
                  <span className={styles.metaValue}>
                    {console.log('Event object:', event)}
                    {console.log('Team type value:', event.team_type)}
                    {event && event.team_type && typeof event.team_type === 'string' 
                      ? (event.team_type.trim().toLowerCase() === 'solo' 
                          ? 'Solo (Individual)' 
                          : event.team_type.trim().toLowerCase() === 'duo' 
                            ? 'Duo (2 Players)' 
                            : event.team_type.trim().toLowerCase() === 'team' 
                              ? 'Team (Multiple Players)' 
                              : `Unknown (${event.team_type})`)
                      : 'Not specified'}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Registrations:</span>
                  <span className={styles.metaValue}>
                    {loading ? (
                      <span className={styles.loadingRegistrations}>Loading...</span>
                    ) : (
                      <>
                        {typeof event.registered_count === 'number' ? event.registered_count : registrations.length}
                        {event.registration_limit ? ` / ${event.registration_limit}` : ''}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            {registrations.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <h2>No Registrations Yet</h2>
                <p>This event doesn&apos;t have any registrations yet.</p>
              </div>
            ) : (
              <div className={styles.registrationsTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>User</div>
                  <div className={styles.tableCell}>Email</div>
                  <div className={styles.tableCell}>Phone</div>
                </div>
                
                {/* Group registrations by team for duo/team events */}
                {event && event.team_type && typeof event.team_type === 'string' && 
                 event.team_type.trim().toLowerCase() === 'duo' ? (
                  // For duo events, group partners together
                  registrations
                    .map((registration, index) => {
                      // Get partner from teamMembers array (API provides this)
                      let partner = null;
                      
                      if (registration.teamMembers && registration.teamMembers.length > 0) {
                        const teamMember = registration.teamMembers[0];
                        partner = {
                          username: teamMember.username,
                          user: {
                            email: teamMember.email || 'No email available',
                            phone: teamMember.phone || null
                          }
                        };
                      } else {
                        // Fallback: extract partner name from notes if teamMembers not available
                        const partnerMatch = registration.notes?.match(/Duo partner:\s*(.+)/i);
                        const partnerName = partnerMatch ? partnerMatch[1].trim() : null;
                        
                        if (partnerName) {
                          partner = {
                            username: partnerName,
                            user: {
                              email: 'Partner not registered',
                              phone: null
                            }
                          };
                        }
                      }
                      
                      // Generate a unique color for this team
                      const teamColor = generateTeamColor(registration.id);
                      
                      return (
                        <div 
                          key={registration.id} 
                          className={styles.duoRegistrationGroup}
                          style={{ 
                            borderLeft: `4px solid ${teamColor}`,
                          }}
                        >
                          <div className={styles.teamIndicator}>
                            <span style={{ backgroundColor: teamColor }} className={styles.teamColorDot}></span>
                            {/* Display team name if available, otherwise use default "Team X" */}
                            {registration.team_name ? registration.team_name : `Team ${index + 1}`}
                          </div>
                          
                          {/* Main Registrant Row */}
                          <div className={styles.registrationRow}>
                            <div className={styles.tableCell} data-label="User">
                              <div className={styles.user}>
                                <div className={styles.userAvatar}>
                                  <div className={styles.avatarPlaceholder}>
                                    {registration.username ? registration.username.charAt(0).toUpperCase() : '?'}
                                  </div>
                                </div>
                                <div className={styles.userDetails}>
                                  <span className={styles.userName}>
                                    {registration.username}
                                  </span>
                                  <span className={styles.teamLeaderBadge}>
                                    TEAM LEADER
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className={styles.tableCell} data-label="Email">
                              {registration.user?.email ? (
                                <span className={styles.userEmail}>
                                  {registration.user.email}
                                </span>
                              ) : (
                                <span className={styles.userEmail}>
                                  No email available
                                </span>
                              )}
                            </div>
                            <div className={styles.tableCell} data-label="Phone">
                              {registration.user?.phone ? (
                                <span className={styles.userPhone}>
                                  {registration.user.phone}
                                </span>
                              ) : (
                                <span className={styles.userPhone}>
                                  No phone available
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Partner Row */}
                          {partner ? (
                            <div className={`${styles.registrationRow} ${styles.partnerRow}`}>
                              <div className={styles.tableCell} data-label="User">
                                <div className={styles.user}>
                                  <div className={styles.userAvatar}>
                                    <div className={styles.avatarPlaceholder}>
                                      {partner.username ? partner.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                  </div>
                                  <div className={styles.userDetails}>
                                    <span className={styles.userName}>
                                      {partner.username || 'Unknown User'}
                                    </span>
                                    <span className={styles.partnerBadge}>
                                      DUO PARTNER
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className={styles.tableCell} data-label="Email">
                                {partner.user?.email ? (
                                  <span className={styles.userEmail}>
                                    {partner.user.email}
                                  </span>
                                ) : (
                                  <span className={styles.userEmail}>
                                    No email available
                                  </span>
                                )}
                              </div>
                              <div className={styles.tableCell} data-label="Phone">
                                {partner.user?.phone ? (
                                  <span className={styles.userPhone}>
                                    {partner.user.phone}
                                  </span>
                                ) : (
                                  <span className={styles.userPhone}>
                                    No phone available
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null}
                          
                          {/* Team actions (remove button etc) */}
                          <div className={styles.teamActions}>
                            <div className={styles.registrationInfo}>
                              <span className={styles.registrationDateLabel}>Registered on:</span>
                              <span className={styles.registrationDate}>
                                {registration.registration_date_formatted || 'Unknown date'}
                              </span>
                            </div>
                            <button
                              className={styles.removeButton}
                              onClick={() => removeRegistration(
                                registration.id, 
                                registration.username || registration.user?.username || 'this user'
                              )}
                              disabled={loading}
                            >
                              Remove Registration
                            </button>
                          </div>
                        </div>
                      );
                    })
                ) : event && event.team_type && typeof event.team_type === 'string' && 
                    event.team_type.trim().toLowerCase() === 'team' ? (
                  // For team events, show main registrant with all team members
                  registrations
                    // Filter to only show main registrants (not team members)
                    .filter(reg => !reg.isPartner)
                    .map((registration, index) => {
                      // Generate a unique color for this team
                      const teamColor = generateTeamColor(registration.id);
                      
                      return (
                        <div 
                          key={registration.id} 
                          className={styles.teamRegistrationGroup}
                          style={{ 
                            borderLeft: `4px solid ${teamColor}`,
                          }}
                        >
                          <div className={styles.teamIndicator} style={{ backgroundColor: teamColor }}>
                            {/* Display team name if available, otherwise use default "Team X" */}
                            {registration.team_name ? registration.team_name : `Team ${index + 1}`}
                          </div>
                          
                          {/* Main Registrant Row */}
                          <div className={styles.tableRow}>
                            <div className={styles.tableCell} data-label="User">
                              <div className={styles.userInfo}>
                                <div 
                                  className={styles.avatarPlaceholder} 
                                  style={{ 
                                    backgroundColor: generateColorFromString(registration.username || 'Unknown'),
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    textTransform: 'uppercase',
                                    marginRight: '0'
                                  }}
                                >
                                  {getInitials(registration.username || 'Unknown')}
                                </div>
                                <div className={styles.userDetails}>
                                  <span className={styles.userName}>
                                    {registration.username || 'Unknown User'}
                                  </span>
                                  <span className={styles.teamLeaderBadge}>
                                    TEAM LEADER
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className={styles.tableCell} data-label="Email">
                              {registration.user?.email && registration.user.email !== 'Unknown' ? (
                                <span className={styles.userEmail}>
                                  {registration.user.email}
                                </span>
                              ) : (
                                <span className={styles.userEmail}>
                                  No email available
                                </span>
                              )}
                            </div>
                            <div className={styles.tableCell} data-label="Phone">
                              {registration.user?.phone ? (
                                <span className={styles.userPhone}>
                                  {registration.user.phone}
                                </span>
                              ) : (
                                <span className={styles.userPhone}>
                                  No phone available
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Team Members Rows */}
                          {registration.teamMembers && registration.teamMembers.length > 0 && (
                            <div className={styles.teamMembersContainer}>
                              {registration.teamMembers.map((member, memberIndex) => (
                                <div 
                                  key={`${registration.id}-member-${memberIndex}`}
                                  className={`${styles.tableRow} ${styles.teamMemberRow}`}
                                >
                                  <div className={styles.tableCell} data-label="User">
                                    <div className={styles.userInfo}>
                                      <div 
                                        className={styles.avatarPlaceholder} 
                                        style={{ 
                                          backgroundColor: generateColorFromString(member.username || 'Unknown'),
                                          color: '#ffffff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: '32px',
                                          height: '32px',
                                          borderRadius: '50%',
                                          fontWeight: 'bold',
                                          fontSize: '14px',
                                          textTransform: 'uppercase',
                                          marginRight: '0'
                                        }}
                                      >
                                        {getInitials(member.username || 'Unknown')}
                                      </div>
                                      <div className={styles.userDetails}>
                                        <span className={styles.userName}>
                                          {member.username || 'Unknown User'}
                                        </span>
                                        <span className={styles.teamMemberBadge}>
                                          TEAM MEMBER
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles.tableCell} data-label="Email">
                                    {member.email ? (
                                      <span className={styles.userEmail}>
                                        {member.email}
                                      </span>
                                    ) : (
                                      <span className={styles.userEmail}>
                                        No email available
                                      </span>
                                    )}
                                  </div>
                                  <div className={styles.tableCell} data-label="Phone">
                                    {member.phone ? (
                                      <span className={styles.userPhone}>
                                        {member.phone}
                                      </span>
                                    ) : (
                                      <span className={styles.userPhone}>
                                        No phone available
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add team actions for team events */}
                          <div className={styles.teamActions}>
                            <div className={styles.registrationInfo}>
                              <span className={styles.registrationDateLabel}>Registration Date:</span>
                              <span className={styles.registrationDate}>
                                {registration.registration_date_formatted || 
                                 (registration.registration_date ? formatTimestamp(registration.registration_date, isMobile) : 'Unknown date')}
                              </span>
                            </div>
                            <button 
                              className={styles.removeButton}
                              onClick={() => removeRegistration(
                                registration.id, 
                                registration.username || registration.user?.username || 'this user'
                              )}
                              disabled={loading}
                            >
                              REMOVE TEAM
                            </button>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  // For solo events, show registrations normally
                  registrations.map((registration, index) => {
                    // Find the partner for this registration if it's a duo event
                    const partner = event && event.team_type === 'duo' && !registration.isPartner
                      ? registrations.find(reg => 
                          reg.isPartner && 
                          reg.registeredBy === registration.username
                        )
                      : null;
                    
                    console.log(`Registration ${index}: ${registration.username}, isPartner: ${registration.isPartner}, partner: ${partner?.username || 'none'}`);
                    
                    return (
                      <React.Fragment key={registration.id}>
                        {/* Main Registration Row */}
                        {!registration.isPartner && (
                          <div 
                            className={`${styles.tableRow} ${styles.mainRow}`}
                            style={{
                              borderLeft: event && event.team_type === 'duo' ? `4px solid ${generateColorFromString(registration.username)}` : 'none'
                            }}
                          >
                            {event && event.team_type === 'duo' && (
                              <div className={styles.teamIndicator}>
                                Team {index + 1}
                              </div>
                            )}
                            <div className={styles.tableCell} data-label="User">
                              <div className={styles.userInfo}>
                                <div 
                                  className={styles.avatarPlaceholder} 
                                  style={{ 
                                    backgroundColor: generateColorFromString(registration.username),
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    textTransform: 'uppercase',
                                    marginRight: '0'
                                  }}
                                >
                                  {getInitials(registration.username)}
                                </div>
                                <div className={styles.userDetails}>
                                  <span className={styles.userName}>
                                    {registration.username}
                                  </span>
                                  {event && event.team_type === 'duo' && (
                                    <span className={styles.duoTeamRole}>
                                      MAIN REGISTRANT
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className={styles.tableCell} data-label="Email">
                              {registration.user?.email ? (
                                <span className={styles.userEmail}>
                                  {registration.user.email}
                                </span>
                              ) : (
                                <span className={styles.userEmail}>
                                  No email available
                                </span>
                              )}
                            </div>
                            <div className={styles.tableCell} data-label="Phone">
                              {registration.user?.phone ? (
                                <span className={styles.userPhone}>
                                  {registration.user.phone}
                                </span>
                              ) : (
                                <span className={styles.userPhone}>
                                  No phone available
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Partner Row - if partner exists */}
                        {partner ? (
                          <div 
                            className={`${styles.tableRow} ${styles.partnerRow}`}
                          >
                            <div className={styles.tableCell} data-label="User">
                              <div className={styles.userInfo}>
                                {/* Partner avatar with consistent styling */}
                                <div 
                                  className={styles.avatarPlaceholder} 
                                  style={{ 
                                    backgroundColor: generateColorFromString(partner.username || 'Unknown'),
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    textTransform: 'uppercase',
                                    marginRight: '0',
                                    border: `2px solid ${generateColorFromString(registration.username)}`
                                  }}
                                >
                                  {getInitials(partner.username || 'Unknown')}
                                </div>
                                <div className={styles.userDetails}>
                                  <span className={styles.userName}>
                                    {partner.username || 'Unknown User'}
                                  </span>
                                  <span className={styles.partnerBadge}>
                                    DUO PARTNER
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className={styles.tableCell} data-label="Email">
                              {console.log('Partner data:', partner)}
                              {console.log('Partner email:', partner.user?.email)}
                              {/* Check if we can find the partner's email in the team members of the main registrant */}
                              {(() => {
                                // Try to find the partner's email in the main registrant's team members
                                const partnerTeamMember = registration.teamMembers?.find(
                                  member => member.user_id === partner.user_id || member.username === partner.username
                                );
                                
                                console.log('Partner team member:', partnerTeamMember);
                                
                                // First try to use the email from the team member
                                if (partnerTeamMember?.email && partnerTeamMember.email !== 'Unknown') {
                                  console.log('Using email from team member:', partnerTeamMember.email);
                                  return (
                                    <span className={styles.userEmail}>
                                      {partnerTeamMember.email}
                                    </span>
                                  );
                                } 
                                // Then try to use the email from the partner's user object
                                else if (partner.user?.email && partner.user.email !== 'Unknown' && partner.user.email !== 'No email found') {
                                  console.log('Using email from partner user object:', partner.user.email);
                                  return (
                                    <span className={styles.userEmail}>
                                      {partner.user.email}
                                    </span>
                                  );
                                } 
                                // Finally, check if the partner has an email property directly
                                else if (partner.email && partner.email !== 'Unknown') {
                                  console.log('Using email directly from partner:', partner.email);
                                  return (
                                    <span className={styles.userEmail}>
                                      {partner.email}
                                    </span>
                                  );
                                }
                                // If no email is found, show a message
                                else {
                                  return (
                                    <span className={styles.userEmail}>
                                      No email available
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        ) : null}
                        
                        {/* Add team actions for solo events */}
                        <div className={styles.teamActions}>
                          <div className={styles.registrationInfo}>
                            <span className={styles.registrationDateLabel}>Registration Date:</span>
                            <span className={styles.registrationDate}>
                              {registration.registration_date_formatted || 
                               (registration.registration_date ? formatTimestamp(registration.registration_date, isMobile) : 'Unknown date')}
                            </span>
                          </div>
                          <button 
                            className={styles.removeButton}
                            onClick={() => removeRegistration(
                              registration.id, 
                              registration.username || registration.user?.username || 'this user'
                            )}
                            disabled={loading}
                          >
                            {partner ? 'REMOVE TEAM' : 'REMOVE'}
                          </button>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}

// 🛡️ SERVER-SIDE PROTECTION: Require admin privileges
export const getServerSideProps = withServerSideAdmin(true); 