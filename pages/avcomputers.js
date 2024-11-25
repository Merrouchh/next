import React, { useEffect, useState } from 'react';
import { fetchActiveUserSessions, fetchUserById, fetchUserBalance } from '../utils/api';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext'; // Assuming you have an Auth context
import Head from 'next/head';

const HostVipComputers = () => {
  const [computers, setComputers] = useState([]);

  useEffect(() => {
    const computersList = [
      { number: 9, id: 21 },
      { number: 10, id: 22 },
      { number: 11, id: 25 },
      { number: 12, id: 20 },
      { number: 13, id: 24 },
      { number: 14, id: 23 },
    ];

    const fetchComputersData = async () => {
      const activeSessions = await fetchActiveUserSessions();
      const updatedComputers = await Promise.all(computersList.map(async (computer) => {
        const session = activeSessions.find(s => s.hostId === computer.id);
        let timeLeft = null;

        if (session) {
          const user = await fetchUserById(session.userId);
          if (user) {
            const balance = await fetchUserBalance(user.id);
            timeLeft = balance;
          }
        }

        return {
          number: computer.number,
          id: computer.id,
          isActive: !!session,
          timeLeft: timeLeft || 'No Time'
        };
      }));

      setComputers(updatedComputers); 
    };

    fetchComputersData();
    const intervalId = setInterval(fetchComputersData, 8000); 

    return () => clearInterval(intervalId); 
  }, []);

  return (
    <div className="vip-computers">
      {computers.map(computer => {
        const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
          ? computer.timeLeft.split(' : ') 
          : [0, 0];

        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const totalMinutes = hours * 60 + minutes;

        return (
          <div key={computer.id} className={`vip-pc-box ${computer.isActive ? (totalMinutes < 60 ? 'orange' : 'active') : 'inactive'}`}>
            <strong>VIP PC{computer.number}</strong><br />
            {computer.isActive ? `Active - Time Left: ${computer.timeLeft}` : 'No User'}
          </div>
        );
      })}
    </div>
  );
};

const AvailableComputers = () => {
  const { isLoggedIn } = useAuth(); 
  const router = useRouter();
  const [computers, setComputers] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/'); 
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    const computersList = [
      { number: 1, id: 26 },
      { number: 2, id: 12 },
      { number: 3, id: 8 },
      { number: 4, id: 5 },
      { number: 5, id: 17 },
      { number: 6, id: 11 },
      { number: 7, id: 16 },
      { number: 8, id: 14 }
    ];

    const fetchComputersData = async () => {
      const activeSessions = await fetchActiveUserSessions();
      const updatedComputers = await Promise.all(computersList.map(async (computer) => {
        const session = activeSessions.find(s => s.hostId === computer.id);
        let timeLeft = null;

        if (session) {
          const user = await fetchUserById(session.userId);
          if (user) {
            const balance = await fetchUserBalance(user.id);
            timeLeft = balance;
          }
        }

        return {
          number: computer.number,
          id: computer.id,
          isActive: !!session,
          timeLeft: timeLeft || 'No Time'
        };
      }));

      setComputers(updatedComputers); 
    };

    fetchComputersData();
    const intervalId = setInterval(fetchComputersData, 5000); 

    return () => clearInterval(intervalId); 
  }, []); 

  if (!isLoggedIn) return null;

  return (
    <>
      <Header />
      <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Available Computers</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main>
        <h2>Normal Computers</h2>

        {/* Normal Computers Grid */}
        <div id="normalComputers" className="computer-grid">
          
            {computers.map(computer => {
                const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
                    ? computer.timeLeft.split(' : ') 
                    : [0, 0];

                const hours = parseInt(timeParts[0]) || 0;
                const minutes = parseInt(timeParts[1]) || 0;
                const totalMinutes = hours * 60 + minutes;

                return (
                    <div key={computer.id} className={`pc-square ${computer.isActive ? (totalMinutes < 60 ? 'warning' : 'active') : 'inactive'}`}>
                    <strong>PC{computer.number}</strong><br />
                    {computer.isActive ? `Active - Time Left: ${computer.timeLeft}` : 'No User'}
                    </div>
                );
            })}
        </div>

        {/* VIP Computers Grid */}
        <h2>VIP PCs</h2>
        <HostVipComputers />
      </main>
    </>
  );
};

export default AvailableComputers;
