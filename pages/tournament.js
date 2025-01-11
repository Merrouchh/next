import React, { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Tournament.module.css';
import { AiOutlineCalendar, AiOutlineTrophy, AiOutlineTeam } from 'react-icons/ai';

const Tournament = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Example tournament data
  const tournamentInfo = {
    name: "Merrouch Gaming League",
    startDate: "March 1, 2024",
    endDate: "April 30, 2024",
    prizePool: "10,000 MAD",
    teams: 20,
    matchesPerTeam: 12,
    totalMatches: 120
  };

  // Example teams data with detailed information
  const teamsData = [
    {
      id: 1,
      name: "Team Alpha",
      played: 8,
      wins: 6,
      draws: 1,
      losses: 1,
      points: 19,
      players: ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"],
      matchHistory: [
        { date: "2024-02-28", opponent: "Team Beta", result: "Win", score: "3-1" },
        { date: "2024-02-25", opponent: "Team Charlie", result: "Win", score: "2-0" },
        // Add more match history
      ],
      upcomingMatches: [
        { date: "2024-03-05", opponent: "Team Delta", time: "17:00", venue: "Station 3" },
        { date: "2024-03-10", opponent: "Team Echo", time: "18:00", venue: "Station 2" },
      ]
    },
    // Add more teams...
  ];

  // Example standings data
  const standings = teamsData.map(team => ({
    rank: team.id,
    team: team.name,
    played: team.played,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    points: team.points
  }));

  // Example upcoming matches
  const upcomingMatches = [
    {
      date: "2024-03-01",
      time: "17:00",
      team1: "Team Alpha",
      team2: "Team Beta",
      venue: "Station 1"
    },
    // Add more matches...
  ];

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
    setActiveTab('teamDetails');
  };

  return (
    <>
      <Head>
        <title>Tournament - Merrouch Gaming</title>
        <meta name="description" content="Merrouch Gaming Tournament Details and Standings" />
      </Head>

      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Merrouch Gaming League</h1>
          
          {/* Tournament Navigation */}
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <AiOutlineTrophy className={styles.tabIcon} /> Overview
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'standings' ? styles.active : ''}`}
              onClick={() => setActiveTab('standings')}
            >
              <AiOutlineTeam className={styles.tabIcon} /> Standings
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'schedule' ? styles.active : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <AiOutlineCalendar className={styles.tabIcon} /> Schedule
            </button>
          </div>

          {/* Tournament Content */}
          <div className={styles.content}>
            {activeTab === 'overview' && (
              <div className={styles.overview}>
                <div className={styles.infoCard}>
                  <h2>Tournament Details</h2>
                  <div className={styles.infoGrid}>
                    <div>
                      <h3>Duration</h3>
                      <p>{tournamentInfo.startDate} - {tournamentInfo.endDate}</p>
                    </div>
                    <div>
                      <h3>Prize Pool</h3>
                      <p>{tournamentInfo.prizePool}</p>
                    </div>
                    <div>
                      <h3>Teams</h3>
                      <p>{tournamentInfo.teams}</p>
                    </div>
                    <div>
                      <h3>Matches Per Team</h3>
                      <p>{tournamentInfo.matchesPerTeam}</p>
                    </div>
                  </div>
                </div>
                
                {/* Teams Overview */}
                <div className={styles.teamsOverview}>
                  <h2>Participating Teams</h2>
                  <div className={styles.teamsGrid}>
                    {teamsData.map(team => (
                      <div 
                        key={team.id} 
                        className={styles.teamCard}
                        onClick={() => handleTeamClick(team)}
                      >
                        <h3>{team.name}</h3>
                        <div className={styles.teamStats}>
                          <span>Played: {team.played}</span>
                          <span>Points: {team.points}</span>
                        </div>
                        <button className={styles.viewDetailsButton}>
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'teamDetails' && selectedTeam && (
              <div className={styles.teamDetails}>
                <div className={styles.teamHeader}>
                  <h2>{selectedTeam.name}</h2>
                  <div className={styles.teamStats}>
                    <div className={styles.statBox}>
                      <span>Played</span>
                      <strong>{selectedTeam.played}</strong>
                    </div>
                    <div className={styles.statBox}>
                      <span>Won</span>
                      <strong>{selectedTeam.wins}</strong>
                    </div>
                    <div className={styles.statBox}>
                      <span>Drawn</span>
                      <strong>{selectedTeam.draws}</strong>
                    </div>
                    <div className={styles.statBox}>
                      <span>Lost</span>
                      <strong>{selectedTeam.losses}</strong>
                    </div>
                    <div className={styles.statBox}>
                      <span>Points</span>
                      <strong>{selectedTeam.points}</strong>
                    </div>
                  </div>
                </div>

                {/* Match History */}
                <div className={styles.matchHistory}>
                  <h3>Match History</h3>
                  <div className={styles.matchList}>
                    {selectedTeam.matchHistory.map((match, index) => (
                      <div key={index} className={styles.historyMatch}>
                        <span className={styles.matchDate}>{match.date}</span>
                        <span className={styles.matchResult}>
                          {selectedTeam.name} vs {match.opponent}
                        </span>
                        <span className={`${styles.result} ${styles[match.result.toLowerCase()]}`}>
                          {match.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming Matches */}
                <div className={styles.upcomingMatches}>
                  <h3>Upcoming Matches</h3>
                  <div className={styles.matchList}>
                    {selectedTeam.upcomingMatches.map((match, index) => (
                      <div key={index} className={styles.upcomingMatch}>
                        <div className={styles.matchInfo}>
                          <span className={styles.matchDate}>{match.date}</span>
                          <span className={styles.matchTime}>{match.time}</span>
                        </div>
                        <div className={styles.matchTeams}>
                          {selectedTeam.name} vs {match.opponent}
                        </div>
                        <div className={styles.venue}>{match.venue}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'standings' && (
              <div className={styles.standings}>
                <table className={styles.standingsTable}>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((team) => (
                      <tr key={team.rank}>
                        <td>{team.rank}</td>
                        <td>{team.team}</td>
                        <td>{team.played}</td>
                        <td>{team.wins}</td>
                        <td>{team.draws}</td>
                        <td>{team.losses}</td>
                        <td>{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className={styles.schedule}>
                {upcomingMatches.map((match, index) => (
                  <div key={index} className={styles.matchCard}>
                    <div className={styles.matchDate}>
                      {match.date} - {match.time}
                    </div>
                    <div className={styles.matchTeams}>
                      <span>{match.team1}</span>
                      <span className={styles.vs}>VS</span>
                      <span>{match.team2}</span>
                    </div>
                    <div className={styles.matchVenue}>
                      {match.venue}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default Tournament; 