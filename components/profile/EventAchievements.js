import React, { useState } from 'react';
import { FaTrophy, FaCalendarCheck, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { IoMdPodium } from 'react-icons/io';
import styles from '../../styles/Profile.module.css';
import Link from 'next/link';

const EventAchievements = ({ achievements }) => {
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded
  
  // Early return if no achievements
  if (!achievements || achievements.length === 0) {
    return null;
  }

  // Sort achievements: first winners, then by date (newest first)
  const sortedAchievements = [...achievements].sort((a, b) => {
    // Winners first
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    
    // Then by date (newest first)
    // Use try/catch for date parsing to handle potential invalid dates
    try {
      return new Date(b.eventDate) - new Date(a.eventDate);
    } catch (error) {
      return 0; // Keep original order if date parsing fails
    }
  });
  
  // Count the number of wins
  const winCount = achievements.filter(a => a.isWinner).length;

  // Toggle expand/collapse
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Safe date formatting function
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return ""; // Return empty string for invalid dates
      }
      return date.toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return "";
    }
  };

  return (
    <>
      <style jsx global>{`
        /* Disable all hover effects for this component */
        .event-participation-section,
        .event-participation-section *,
        .event-participation-section *:hover,
        .event-participation-section *:active,
        .event-participation-section *:focus {
          transition: none !important;
          transform: none !important;
          box-shadow: none !important;
          text-decoration: none !important;
          border-color: #222 !important;
        }
        
        .event-participation-section a:hover,
        .event-participation-section a:hover *,
        .event-participation-section a:hover h4,
        .event-participation-section a:hover span,
        .event-participation-section a:hover div,
        .event-participation-section button:hover,
        .event-participation-section button:hover * {
          color: inherit !important;
          background-color: transparent !important;
          opacity: 1 !important;
        }
        
        .event-participation-section button {
          cursor: pointer;
        }
        
        .event-participation-section a {
          cursor: pointer;
        }

        /* Target the specific icon to prevent color change */
        .event-participation-section svg {
          fill: currentColor !important;
          color: #FFD700 !important;
        }

        .event-participation-section button:hover svg,
        .event-participation-section button svg:hover {
          fill: #FFD700 !important;
          color: #FFD700 !important;
        }

        /* Override any possible hover selectors */
        .event-participation-section [class*="MdPodium"],
        .event-participation-section [class*="MdPodium"]:hover {
          color: #FFD700 !important;
          fill: #FFD700 !important;
        }
      `}</style>

      <div 
        className={`${styles.eventAchievements} ${!isExpanded ? styles.collapsed : ''} event-participation-section`}
        style={{
          backgroundColor: '#0e0e0e', 
          borderRadius: '8px',
          margin: isExpanded ? '5px 0 15px' : '5px 0 0',
          overflow: 'hidden',
          border: '1px solid #222'
        }}
      >
        <button 
          className={styles.profilesHeader}
          onClick={toggleExpand}
          type="button"
          aria-expanded={isExpanded}
          aria-controls="event-achievements-content"
          style={{ 
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 15px',
            color: '#fff',
            position: 'relative',
            margin: 0
          }}
        >
          <IoMdPodium style={{ color: '#FFD700 !important', fontSize: '22px', marginRight: '12px', fill: '#FFD700 !important' }} />
          <h3 style={{ margin: 0, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '16px' }}>
            EVENT PARTICIPATION ({achievements.length})
          </h3>
          <div style={{ position: 'absolute', right: '15px', display: 'flex', alignItems: 'center' }}>
            {winCount > 0 && <span style={{ backgroundColor: 'rgba(255, 215, 0, 0.15)', color: '#FFD700', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginRight: '12px' }}>{winCount} wins</span>}
            <span aria-hidden="true" style={{ 
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)', 
              color: '#FFD700 !important',
              display: 'flex',
              alignItems: 'center'
            }}>
              <FaChevronUp style={{ fontSize: '14px', color: '#FFD700 !important', fill: '#FFD700 !important' }} />
            </span>
          </div>
        </button>

        <div 
          id="event-achievements-content" 
          style={{
            maxHeight: isExpanded ? '2000px' : '0',
            height: isExpanded ? 'auto' : '0',
            padding: 0,
            margin: 0,
            overflow: 'hidden',
            opacity: isExpanded ? 1 : 0,
            display: 'block'
          }}
        >
          <div style={{ display: isExpanded ? 'block' : 'none' }}>
            {sortedAchievements.map((achievement) => (
              <Link 
                href={`/events/${achievement.eventId}`} 
                key={achievement.eventId}
                style={{
                  backgroundColor: 'transparent',
                  borderBottom: '1px solid #222',
                  padding: '12px 15px',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: '#fff',
                  marginBottom: '0'
                }}
              >
                <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                  {achievement.isWinner ? (
                    <FaTrophy style={{ color: '#FFD700', fontSize: '18px' }} />
                  ) : (
                    <FaCalendarCheck style={{ color: '#aaa', fontSize: '18px' }} />
                  )}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#fff',
                      letterSpacing: '0.2px'
                    }}>
                      {achievement.eventTitle || "Unnamed Event"}
                    </h4>
                    {achievement.isWinner && (
                      <span style={{ 
                        backgroundColor: '#FFD700', 
                        color: '#111', 
                        fontSize: '10px', 
                        padding: '1px 5px', 
                        borderRadius: '3px', 
                        marginLeft: '8px',
                        fontWeight: 700,
                        letterSpacing: '0.2px'
                      }}>
                        WINNER
                      </span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#888', marginTop: '3px' }}>
                    {achievement.game || "Gaming Event"}
                    
                    {achievement.teamType !== 'solo' && achievement.partners && achievement.partners.length > 0 && (
                      <span style={{ color: '#777', fontSize: '13px', marginLeft: '8px' }}>
                        • With:{' '}
                        {achievement.partners.map((partner, index) => (
                          <React.Fragment key={partner.userId || index}>
                            <span style={{ color: '#FFD700' }}>
                              {partner.username}
                            </span>
                            {index < achievement.partners.length - 1 ? ', ' : ''}
                          </React.Fragment>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={{ fontSize: '13px', color: '#777', marginLeft: '10px', textAlign: 'right' }}>
                  {formatDate(achievement.eventDate)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default EventAchievements; 