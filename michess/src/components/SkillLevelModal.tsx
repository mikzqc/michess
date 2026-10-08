import React, { useState } from 'react';
import { Button } from './ui/Button';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { Trophy, Star, Shield, Crown } from 'lucide-react';

interface SkillLevelModalProps {
  onComplete: () => void;
}

export const SkillLevelModal: React.FC<SkillLevelModalProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(400);

  const levels = [
    { value: 400, label: 'New to Chess', icon: Star, desc: 'Most common', color: 'text-success' },
    { value: 800, label: 'Beginner', icon: Shield, desc: 'Knows how pieces move', color: 'text-content-1' },
    { value: 1200, label: 'Intermediate', icon: Trophy, desc: 'Has played quite a bit', color: 'text-content-1' },
    { value: 1600, label: 'Advanced', icon: Crown, desc: 'Experienced tournament player', color: 'text-content-1' },
  ];

  const handleContinue = async () => {
    if (!user || selectedLevel === null || !supabase) return;
    setLoading(true);
    
    try {
      const { error } = await supabase.from('profiles').update({
        highest_rating: selectedLevel,
        rating_bullet: selectedLevel,
        rating_blitz: selectedLevel,
        rating_rapid: selectedLevel,
        puzzle_rating: selectedLevel
      }).eq('id', user.id);

      if (error) throw error;
      
      addToast('Starting skill level set!', 'success');
      onComplete();
    } catch (err) {
      console.error('Error setting skill level:', err);
      addToast('Failed to set skill level', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in relative flex flex-col max-h-[90vh]">
        
        <div className="p-8 pb-4 text-center">
          <h2 className="text-2xl font-bold text-content-1 mb-2">What is your chess skill level?</h2>
          <p className="text-content-3 text-sm">A starting point for match pairings</p>
        </div>

        <div className="p-6 pt-2 space-y-3 overflow-y-auto">
          {levels.map(level => {
            const isSelected = selectedLevel === level.value;
            const Icon = level.icon;
            
            return (
              <button
                key={level.value}
                onClick={() => setSelectedLevel(level.value)}
                className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                  isSelected 
                    ? 'border-success bg-success/10 shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                    : 'border-border-1 bg-surface-3 hover:border-content-3 hover:bg-surface-4'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-content-1">{level.label}</span>
                    {isSelected && <span className="text-success text-sm">✓</span>}
                  </div>
                  {level.desc && (
                    <p className={`text-xs mt-1 ${isSelected ? 'text-success' : 'text-content-3'}`}>
                      {level.desc}
                    </p>
                  )}
                </div>
                <div className={isSelected ? 'text-success' : 'text-content-2'}>
                  <Icon size={24} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-6 pt-4 border-t border-border-1/50 bg-surface-1/50 backdrop-blur-md">
          <Button 
            className="w-full py-4 text-lg font-bold bg-success hover:bg-success-hover text-white shadow-lg"
            onClick={handleContinue}
            disabled={loading || selectedLevel === null}
          >
            {loading ? 'Saving...' : 'Continue'}
          </Button>
        </div>
        
      </div>
    </div>
  );
};
