import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from '../components/Toast';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked_at?: string;
}

export function useAchievements(userId?: string) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }

    const fetchAchievements = async () => {
      try {
        // Fetch all achievements
        const { data: allAchievements, error: err1 } = await supabase!.from('achievements').select('*');
        if (err1) throw err1;

        // Fetch user's unlocked achievements
        const { data: userUnlocked, error: err2 } = await supabase!
          .from('user_achievements')
          .select('*')
          .eq('user_id', userId);
        if (err2) throw err2;

        const unlockedMap = new Map(userUnlocked?.map(ua => [ua.achievement_id, ua.unlocked_at]));

        const combined = (allAchievements || []).map(a => ({
          ...a,
          unlocked_at: unlockedMap.get(a.id)
        }));

        setAchievements(combined);
      } catch (err) {
        console.error('Error fetching achievements', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [userId]);

  const unlockAchievement = async (achievementId: string) => {
    if (!userId || !supabase) return;
    try {
      const { error } = await supabase.from('user_achievements').insert({
        user_id: userId,
        achievement_id: achievementId
      });
      
      if (!error) {
        // Find the achievement details to show in the toast
        const achievement = achievements.find(a => a.id === achievementId);
        if (achievement) {
          addToast(`Achievement Unlocked: ${achievement.name}! 🏆`, 'success');
          
          // Optimistically update local state
          setAchievements(prev => prev.map(a => 
            a.id === achievementId 
              ? { ...a, unlocked_at: new Date().toISOString() } 
              : a
          ));
        }
      }
    } catch (err) {
      // Ignore unique constraint violations (already unlocked)
    }
  };

  return { achievements, loading, unlockAchievement };
}
