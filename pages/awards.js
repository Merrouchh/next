import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
// DynamicMeta removed - metadata now handled in _document.js
import styles from '../styles/Awards.module.css';
import Head from 'next/head';
import { FaUnlock, FaStar, FaUserCircle } from 'react-icons/fa';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Import achievement components
import AchievementGrid from '../components/achievements/AchievementGrid';

// Import achievement services and utilities
import { 
  updateAchievementsInDatabase,
  checkUserHasClips,
  checkTournamentParticipation,
  claimAchievement,
  markAchievementNotified,
  checkUserHasInteracted,
  addGameHours
} from '../lib/achievements/achievementService';
import { 
  processAchievements,
  findNewlyCompletedAchievements,
  markAchievementsAsCompleted,
  markAchievementAsClaimed,
  markAchievementAsPending,
  countClaimedAchievements
} from '../lib/achievements/achievementUtils';
import {
  showAchievementNotifications,
  notifyAchievementClaimed,
  initNotificationSystem
} from '../lib/achievements/notificationSystem';

/**
 * Loading spinner component
 */
const LoadingSpinner = () => (
  <div className={styles.loadingContainer}>
    <div className={styles.spinner}></div>
    <p>Loading your achievements...</p>
  </div>
);

/**
 * Awards/Achievements page component
 */
const AwardsPage = () => {
  const { user, supabase } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [lastReviewStatus, setLastReviewStatus] = useState(null);
  // Ref to track notifications shown in the current session
  const notifiedAchievementsRef = useRef(new Set());

  /**
   * Check for async achievements like clips and tournament participation
   * This function only checks and doesn't show notifications
   * @returns {Promise<Array>} Array of newly completed achievement IDs
   */
  const checkAsyncAchievements = async () => {
    if (!user?.id) return [];
    
    try {
      let newlyCompleted = [];
      const currentAchievements = [...achievements];
      
      // 1. Check clips achievement
      const clipAchievement = currentAchievements.find(a => a.id === 'first-clip');
      const hasClips = await checkUserHasClips(supabase, user.id);
      
      if (hasClips && !clipAchievement?.completed && !clipAchievement?.claimed) {
        newlyCompleted.push('first-clip');
      }
      
      // 2. Check tournament participation
      const tournamentAchievement = currentAchievements.find(a => a.id === 'first-tournament');
      const hasParticipated = await checkTournamentParticipation(supabase, user.id);
      
      if (hasParticipated && !tournamentAchievement?.completed && !tournamentAchievement?.claimed) {
        newlyCompleted.push('first-tournament');
      }
      
      // 3. Check phone verification
      const phoneAchievement = currentAchievements.find(a => a.id === 'phone-verified');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .single();
      
      if (!userError && userData?.phone && !phoneAchievement?.completed && !phoneAchievement?.claimed) {
        newlyCompleted.push('phone-verified');
      }
      
      // 4. Check clip interaction (both like and comment)
      const interactionAchievement = currentAchievements.find(a => a.id === 'first-interaction');
      
      if (interactionAchievement && !interactionAchievement.completed && !interactionAchievement.claimed) {
        // Check both likes and comments
        let hasLiked = false;
        let hasCommented = false;
        
        // Check for likes
        const { count: likesCount, error: likesError } = await supabase
          .from('video_likes')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(1);
          
        if (!likesError && likesCount > 0) {
          hasLiked = true;
        }
        
        // Check for comments
        const { count: commentsCount, error: commentsError } = await supabase
          .from('clip_comments')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(1);
          
        if (!commentsError && commentsCount > 0) {
          hasCommented = true;
        }
        
        // Only add to completed if user has both liked and commented
        if (hasLiked && hasCommented) {
          newlyCompleted.push('first-interaction');
        }
      }
      
      // Filter out any achievements that are already claimed
      if (newlyCompleted.length > 0) {
        // Get the database status of all these achievements to verify claim state
        const { data: achievementRecords, error: achievementError } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', user.id)
          .in('achievement_id', newlyCompleted);
        
        if (!achievementError && achievementRecords) {
          const claimedIds = achievementRecords
            .filter(record => record.status === 'claimed')
            .map(record => record.achievement_id);
            
          if (claimedIds.length > 0) {
            newlyCompleted = newlyCompleted.filter(id => !claimedIds.includes(id));
          }
        }
        
        // Update database to mark achievements as completed
        if (newlyCompleted.length > 0) {
          await updateAchievementsInDatabase(supabase, user.id, newlyCompleted);
        }
      }
      
      // Return the newly completed achievement IDs
      return newlyCompleted;
    } catch (error) {
      return [];
    }
  };

  // Load user data and achievements
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      // Initialize notification system
      initNotificationSystem();
      
      setLoading(true);
      try {
        // 1. Load user profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('favorite_game, discord_id, valorant_id, fortnite_name, battlenet_id, points')
          .eq('id', user.id)
          .single();

        if (userError) {
          if (userError.code === 'PGRST401') {
            toast.error('Session expired. Please refresh the page.');
          } else {
            toast.error('Failed to load user data');
          }
          setLoading(false);
          return;
        }
        
        setUserPoints(userData.points || 0);
        
        // 2. Check for likes and comments for the interaction achievement
        let hasLiked = false;
        let hasCommented = false;
        
        // Check for likes
        const { count: likesCount, error: likesError } = await supabase
          .from('video_likes')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(1);
          
        if (!likesError && likesCount > 0) {
          hasLiked = true;
        }
        
        // Check for comments
        const { count: commentsCount, error: commentsError } = await supabase
          .from('clip_comments')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(1);
          
        if (!commentsError && commentsCount > 0) {
          hasCommented = true;
        }
        
        // 3. Load achievement status from database
        const { data: userAchievements, error: achievementsError } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', user.id);

        if (achievementsError) {
          toast.error('Failed to load achievements data');
          setLoading(false);
          return;
        }
        
        // 4. Create a map of achievement statuses from database
        const achievementStatusMap = {};
        userAchievements?.forEach(item => {
          achievementStatusMap[item.achievement_id] = {
            status: item.status,
            completed: item.status === 'completed' || item.status === 'claimed',
            claimed: item.status === 'claimed',
            pending: item.status === 'pending_verification',
            date_completed: item.completed_at,
            date_claimed: item.claimed_at,
            was_notified: item.was_notified || false,
            notified_at: item.notified_at
          };
        });
        
        // Count how many achievements have been claimed
        const claimedAchievementsCount = userAchievements?.filter(item => 
          item.status === 'claimed'
        ).length || 0;
        
        // Add all enhanced data to userData
        const enhancedUserData = {
          ...userData,
          has_liked: hasLiked,
          has_commented: hasCommented,
          claimed_achievements_count: claimedAchievementsCount
        };

        // Check if review achievement was previously pending and is now completed
        const reviewAchievement = achievementStatusMap['five-star-review'];
        
        // Special case: Force notification for newly completed review achievements
        const reviewCompleted = reviewAchievement && 
                               (reviewAchievement.status === 'completed' || reviewAchievement.completed) && 
                               !reviewAchievement.claimed && 
                               !reviewAchievement.was_notified;
                               
        // Check if a pending review was verified by an admin
        const reviewWasVerified = 
          lastReviewStatus === 'pending_verification' && 
          reviewAchievement && 
          reviewAchievement.status !== 'pending_verification' && 
          (reviewAchievement.completed || reviewAchievement.status === 'completed') &&
          !reviewAchievement.was_notified;
        
        // Update the last known review status for next comparison
        setLastReviewStatus(
          reviewAchievement?.pending ? 'pending_verification' : 
          reviewAchievement?.completed ? 'completed' : 
          reviewAchievement?.claimed ? 'claimed' : null
        );
        
        // If a review was verified, add it to the newly completed list
        const newCompletions = [];
        if (reviewWasVerified || reviewCompleted) {
          newCompletions.push('five-star-review');
        }

        // 5. Process achievements with current status
        const processedAchievements = processAchievements(achievementStatusMap, enhancedUserData);
        
        // 6. Check for achievements that should be completed
        const newlyCompletedIds = findNewlyCompletedAchievements(processedAchievements, enhancedUserData);
        
        // Add any admin-verified achievements to the newly completed list
        if (newCompletions.length > 0) {
          newCompletions.forEach(id => {
            if (!newlyCompletedIds.includes(id)) {
              newlyCompletedIds.push(id);
            }
          });
        }
        
        // All achievements marked as newly completed (both auto-detected and admin-verified) 
        // go through exactly the same notification system
        let updatedAchievements = markAchievementsAsCompleted(processedAchievements, newlyCompletedIds);
        
        // Set achievements state initially to allow the async check to use it
        setAchievements(updatedAchievements);
        
        // Check for async achievements before showing notifications
        // This ensures we only show one set of notifications for all achievements
        const asyncCompletedIds = await checkAsyncAchievements();
        
        // Combine all newly completed achievements from both checks
        const allCompletedIds = [...newlyCompletedIds];
        
        // Add any async completed achievements
        if (asyncCompletedIds.length > 0) {
          // Add only unique IDs
          asyncCompletedIds.forEach(id => {
            if (!allCompletedIds.includes(id)) {
              allCompletedIds.push(id);
            }
          });
          
          // Update achievements with async completions
          updatedAchievements = markAchievementsAsCompleted(updatedAchievements, asyncCompletedIds);
          setAchievements(updatedAchievements);
        }
        
        // 7. Handle database updates and notifications for newly completed achievements
        // This is the SINGLE notification path for ALL types of achievements
        if (allCompletedIds.length > 0) {
          // Update achievement statuses in the database first
          await updateAchievementsInDatabase(supabase, user.id, allCompletedIds);
          
          // Show notifications for newly completed achievements that haven't been notified yet
          // ONLY USE DATABASE FIELD to determine if notification should be shown
          // AND filter out achievements already notified in this session (for StrictMode double renders)
          const achievementsToNotify = updatedAchievements.filter(a => 
            allCompletedIds.includes(a.id) && 
            !a.was_notified && 
            !notifiedAchievementsRef.current.has(a.id)
          );
          
          if (achievementsToNotify.length > 0) {
            // Mark achievements as notified in our session ref BEFORE showing notifications
            // This prevents double notifications during the same session
            achievementsToNotify.forEach(a => {
              notifiedAchievementsRef.current.add(a.id);
            });
            
            // Show the notifications - ALL achievements use this SAME notification system
            showAchievementNotifications(achievementsToNotify);
            
            // Mark achievements as notified in the database
            for (const achievement of achievementsToNotify) {
              try {
                await markAchievementNotified(supabase, user.id, achievement.id);
              } catch (error) {
                // Error handling
              }
            }
            
            // Force immediate UI update
            setAchievements(current => 
              current.map(a => 
                achievementsToNotify.some(n => n.id === a.id) 
                  ? {...a, was_notified: true} 
                  : a
              )
            );
          }
        }
      } catch (error) {
        toast.error('Failed to load achievements');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, supabase, lastReviewStatus]);

  /**
   * Handle claiming an achievement reward
   */
  const handleClaimAchievement = async (achievementId) => {
    if (!user?.id) {
      toast.error('You need to be logged in to claim achievements');
      return;
    }
    
    setClaimingId(achievementId);
    
    try {
      const achievement = achievements.find(a => a.id === achievementId);
      
      if (!achievement) {
        throw new Error('Achievement not found');
      }
      
      if (!achievement.completed) {
        toast.error('This achievement is not completed yet');
        setClaimingId(null);
        return;
      }
      
      if (achievement.claimed) {
        toast.error('This achievement has already been claimed');
        setClaimingId(null);
        return;
      }
      
      // Check if this is the achievement-collector achievement with game time reward
      if (achievementId === 'achievement-collector' && achievement.extraRewards?.gameHours) {
        // Add the game hours to the user's account FIRST, before claiming achievement
        const hoursToAdd = achievement.extraRewards.gameHours;
        console.log(`[AMOUNT DEBUG] Achievement Hunter: Adding ${hoursToAdd} hour reward before claiming`);
        
        // Add a timestamp to track this specific reward action
        const rewardTimestamp = new Date().toISOString();
        console.log(`[AMOUNT DEBUG] Achievement reward action at ${rewardTimestamp}`);
        
        const gameTimeResult = await addGameHours(supabase, user.id, hoursToAdd);
        
        if (!gameTimeResult.success) {
          console.error(`[AMOUNT DEBUG] Achievement reward failed at ${rewardTimestamp}:`, gameTimeResult.error);
          toast.error(`Cannot claim achievement: Game time reward failed to add (${gameTimeResult.error})`, {
            duration: 5000,
          });
          console.error('Failed to add game time:', gameTimeResult);
          setClaimingId(null);
          return; // Exit early without claiming the achievement
        }
        
        // If successful, show success toast for the game time
        console.log(`[AMOUNT DEBUG] Achievement reward successful at ${rewardTimestamp}`);
        toast.success(`You've earned ${hoursToAdd} hour of game time!`, {
          duration: 5000,
          icon: '⏰',
          style: {
            background: '#333',
            color: '#fff',
            border: '1px solid #9D4EDD',
          }
        });
      }
      
      // Now proceed with claiming the achievement and updating points in the database
      const result = await claimAchievement(
        supabase,
        user.id,
        achievementId,
        achievement.points,
        achievement.date_completed
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to claim achievement');
      }
      
      // Update local state
      setUserPoints(result.points);
      
      // First mark this achievement as claimed
      const updatedAchievements = markAchievementAsClaimed(achievements, achievementId);
      
      // Then update the achievement-collector progress
      const newClaimedCount = countClaimedAchievements(updatedAchievements);
      const finalAchievements = updatedAchievements.map(a => {
        if (a.id === 'achievement-collector') {
          return {
            ...a,
            progress: Math.min(newClaimedCount, 6)
          };
        }
        return a;
      });
      
      // Update achievements state with both changes
      setAchievements(finalAchievements);
      
      // Show success notification
      notifyAchievementClaimed(achievement.name, achievement.points);
      
      // Check if achievement-collector is now completed after this claim
      const collectorAchievement = finalAchievements.find(a => a.id === 'achievement-collector');
      if (collectorAchievement && 
          collectorAchievement.progress >= 6 && 
          !collectorAchievement.completed && 
          achievementId !== 'achievement-collector') { // Only auto-complete if we're not already claiming it
        // Auto-complete the achievement-collector achievement (but don't auto-claim)
        const completedAchievements = markAchievementsAsCompleted(
          finalAchievements, 
          ['achievement-collector']
        );
        
        // Update in database
        await updateAchievementsInDatabase(supabase, user.id, ['achievement-collector']);
        
        // Update state and show notification
        setAchievements(completedAchievements);
        showAchievementNotifications([collectorAchievement]);
      }
    } catch (error) {
      toast.error('Failed to claim achievement: ' + error.message);
    } finally {
      setClaimingId(null);
    }
  };

  /**
   * Handle successful review screenshot upload
   */
  const handleReviewSuccess = () => {
    // Update the achievement to pending status
    setAchievements(markAchievementAsPending(achievements, 'five-star-review'));
  };

  // Count claimed achievements
  const claimedCount = countClaimedAchievements(achievements);

  return (
    <>
      <Head>
        <title>Gaming Achievements & Awards | Merrouch Gaming Center</title>
      </Head>
      <ProtectedPageWrapper>
        <div className={styles.awardsContainer}>
        <header className={styles.awardsHeader}>
          <h1 className={styles.awardsTitle}>YOUR ACHIEVEMENTS</h1>
          <div className={styles.awardsStats}>
            <div className={styles.statItem}>
              <FaUnlock className={styles.statIcon} />
              <span>{claimedCount} Achievements Claimed</span>
            </div>
            <div className={styles.statItem}>
              <FaStar className={styles.statIcon} />
              <span>{userPoints} Total Points</span>
            </div>
          </div>
          
          <Link href={`/profile/${user?.username}`} className={styles.backToProfileBtn}>
            <FaUserCircle />
            <span>Back to Profile</span>
          </Link>
        </header>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className={styles.awardsSection}>
            <AchievementGrid
              achievements={achievements}
              claimingId={claimingId}
              onClaimAchievement={handleClaimAchievement}
              supabase={supabase}
              userId={user?.id}
              onReviewSuccess={handleReviewSuccess}
            />
          </div>
        )}
      </div>
    </ProtectedPageWrapper>
    </>
  );
};

export default AwardsPage; 