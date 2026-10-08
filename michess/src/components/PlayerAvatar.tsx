import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface PlayerAvatarProps {
  userId?: string | null;
  color: 'white' | 'black';
  className?: string;
  isBot?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ userId, color, className = '', isBot = false }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isBot || !userId) {
      setAvatarUrl(null);
      return;
    }
    
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
          .single();
          
        if (!error && isMounted && data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      } catch (err) {
        // silently ignore
      }
    };
    
    fetchProfile();
    
    return () => { 
      isMounted = false; 
    };
  }, [userId, isBot]);

  if (avatarUrl) {
    return (
      <img 
        src={avatarUrl} 
        alt="Player avatar" 
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center font-bold ${color === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-[#222] text-white border border-gray-600'} ${className}`}>
      {color === 'white' ? 'W' : 'B'}
    </div>
  );
};
