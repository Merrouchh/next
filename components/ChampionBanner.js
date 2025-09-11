import React from 'react';

const ChampionBanner = ({ 
  champion, 
  className = '', 
  bracketData, 
  event 
}) => {
  // Helper function to detect champion from bracket data
  const detectChampion = () => {
    if (!bracketData?.bracket || !Array.isArray(bracketData.bracket)) {
      return null;
    }

    // Get the final round (last array in bracket)
    const finalRound = bracketData.bracket[bracketData.bracket.length - 1];
    
    if (!finalRound || finalRound.length === 0) {
      return null;
    }

    // Get the final match (last match in final round)
    const finalMatch = finalRound[finalRound.length - 1];
    
    // Check if we have a valid final match with a winner
    // For solo events, matches might not have a status field, so we just check for winnerId
    if (!finalMatch || !finalMatch.winnerId) {
      return null;
    }
    
    // If status exists, check if it's completed (for duo/team events)
    if (finalMatch.status && finalMatch.status !== 'completed') {
      return null;
    }

    let winnerName = 'Unknown Winner';

    // For duo/team events, prioritize team name from participants data
    if ((event.team_type === 'duo' || event.team_type === 'team') && bracketData.participants) {
      // Find the winner in participants array to get their team_name
      const winnerParticipant = bracketData.participants.find(p => 
        p.id == finalMatch.winnerId || 
        p.userId == finalMatch.winnerId ||
        p.user_id == finalMatch.winnerId
      );
      
      if (winnerParticipant?.team_name) {
        winnerName = winnerParticipant.team_name;
      } else {
        // Fallback to individual participant names
        winnerName = finalMatch.participant1Name || finalMatch.participant2Name || 'Unknown Winner';
      }
    } else {
      // For solo events, use individual participant names
      winnerName = finalMatch.participant1Name || finalMatch.participant2Name || 'Unknown Winner';
    }

    return {
      name: winnerName,
      isTeam: event.team_type === 'duo' || event.team_type === 'team'
    };
  };

  // Get champion data (either from props or detected from bracket)
  const championData = champion || detectChampion();
  
  if (!championData) {
    return null;
  }

  const { name, isTeam } = championData;

  return (
    <div className={`champion-banner ${className}`}>
      <div className="champion-content">
        <div className="champion-info">
          <div className="champion-badge">
            {isTeam ? 'Champions' : 'Champion'}
          </div>
          <h3 className="champion-name">{name}</h3>
        </div>
      </div>
      
      <style jsx>{`
        .champion-banner {
          background: #ffd700;
          border: 1px solid #e6c200;
          border-radius: 12px;
          padding: 24px;
          margin: 24px 0;
          box-shadow: 
            0 8px 32px rgba(255, 215, 0, 0.3),
            0 0 0 1px rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
        }

        .champion-banner::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            45deg, 
            transparent 0%, 
            transparent 30%, 
            rgba(255, 255, 255, 0.3) 50%, 
            transparent 70%, 
            transparent 100%
          );
          animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { 
            transform: translateX(-100%) skewX(-15deg); 
            opacity: 0; 
          }
          50% { 
            transform: translateX(0%) skewX(-15deg); 
            opacity: 1; 
          }
          100% { 
            transform: translateX(100%) skewX(-15deg); 
            opacity: 0; 
          }
        }

        .champion-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
          position: relative;
          z-index: 1;
        }

        .champion-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .champion-badge {
          display: inline-block;
          background: #000000;
          color: #ffd700;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .champion-name {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #000000;
          line-height: 1.3;
          letter-spacing: -0.3px;
        }


        @media (max-width: 768px) {
          .champion-banner {
            padding: 20px;
            margin: 20px 0;
          }

          .champion-content {
            gap: 16px;
          }

          .champion-name {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .champion-banner {
            padding: 16px;
          }

          .champion-name {
            font-size: 1.125rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ChampionBanner;