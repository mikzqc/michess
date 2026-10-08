import { useEffect } from 'react';
import { useProfile } from './useProfile';
import { useAchievements } from './useAchievements';

export function useAchievementTracker() {
  const { profile } = useProfile();
  const { achievements, unlockAchievement } = useAchievements(profile?.id);

  useEffect(() => {
    if (!profile || !achievements.length) return;

    // Check conditions and unlock if not already unlocked
    const checkAndUnlock = (id: string, condition: boolean) => {
      const achievement = achievements.find(a => a.id === id);
      if (achievement && !achievement.unlocked_at && condition) {
        unlockAchievement(id);
      }
    };

    // Games played
    checkAndUnlock('first_game', profile.games_played >= 1);
    checkAndUnlock('10_games', profile.games_played >= 10);
    checkAndUnlock('50_games', profile.games_played >= 50);
    checkAndUnlock('100_games', profile.games_played >= 100);
    
    // Wins
    checkAndUnlock('first_win', profile.wins >= 1);
    
    // Rating (Overall rating doesn't exist explicitly in profile, so we use highest_rating or one of the time controls)
    const maxRating = Math.max(
      profile.highest_rating || 100, 
      profile.rating_bullet || 100, 
      profile.rating_blitz || 100, 
      profile.rating_rapid || 100
    );
    
    checkAndUnlock('rating_1000', maxRating >= 1000);
    checkAndUnlock('rating_1250', maxRating >= 1250);
    checkAndUnlock('rating_1500', maxRating >= 1500);
    
    // Win streak
    checkAndUnlock('win_streak_5', (profile.longest_win_streak || 0) >= 5 || (profile.current_streak || 0) >= 5);

  }, [profile, achievements, unlockAchievement]);
}
