import React from 'react';
import { User, ArrowLeft, ShieldCheck, Swords, UserPlus } from 'lucide-react';
import { usePublicProfile } from '../hooks/usePublicProfile';
import { Button } from './ui/Button';

interface PublicProfileProps {
  username: string;
  onExit: () => void;
  onChallenge: (userId: string) => void;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ username, onExit, onChallenge }) => {
  const { profile, loading, error } = usePublicProfile(username);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 mt-20">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 mt-20 animate-fade-in">
        <p className="text-content-3">Profile not found.</p>
        <Button onClick={onExit}>
          Back
        </Button>
      </div>
    );
  }

  const winRate = profile.games_played > 0 
    ? Math.round((profile.wins / profile.games_played) * 100) 
    : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 animate-fade-in mt-10">
      <Button 
        variant="ghost"
        onClick={onExit}
        className="mb-8 pl-0"
      >
        <ArrowLeft size={20} className="mr-2" /> Back
      </Button>

      <div className="bg-surface-2 border border-border-1 rounded-xl p-8 relative overflow-hidden shadow-sm animate-slide-up">
        
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-surface-3 rounded-full flex items-center justify-center border-4 border-border-2 overflow-hidden shadow-sm">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-content-3" />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-bold text-content-1 mb-2">
                {profile.username}
              </h1>
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent px-3 py-1 rounded-full font-bold text-sm border border-accent/20">
                  {profile.rating} ELO
                </span>
                <span className="text-success font-bold bg-success/10 px-3 py-1 rounded-full text-sm border border-success/20 flex items-center gap-1">
                  <ShieldCheck size={14} /> Active
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Button 
              onClick={() => onChallenge(profile.id)}
              className="w-full sm:w-auto"
            >
              <Swords size={20} className="mr-2" /> Challenge
            </Button>
            <Button 
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <UserPlus size={20} className="mr-2" /> Add Friend
            </Button>
          </div>
        </div>

        <div className="space-y-8 pt-6 border-t border-border-1">
          
          <h2 className="text-2xl font-bold text-content-1 mb-4">Player Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-3 p-5 rounded-lg border border-border-1 flex flex-col items-center justify-center text-center">
              <span className="text-content-3 text-sm font-bold mb-1">Highest Rating</span>
              <span className="text-3xl text-warning font-black">{profile.highest_rating || 1200}</span>
            </div>
            <div className="bg-surface-3 p-5 rounded-lg border border-border-1 flex flex-col items-center justify-center text-center">
              <span className="text-content-3 text-sm font-bold mb-1">Win Rate</span>
              <span className="text-3xl text-content-1 font-black">{winRate}%</span>
            </div>
            <div className="bg-surface-3 p-5 rounded-lg border border-border-1 flex flex-col items-center justify-center text-center">
              <span className="text-content-3 text-sm font-bold mb-1">Total Games</span>
              <span className="text-3xl text-content-1 font-black">{profile.games_played}</span>
            </div>
            <div className="bg-surface-3 p-5 rounded-lg border border-border-1 flex flex-col items-center justify-center text-center">
              <span className="text-content-3 text-sm font-bold mb-1">Win Streak</span>
              <span className="text-3xl text-success font-black">{profile.current_streak}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-success/10 p-4 rounded-lg border border-success/20 flex flex-col items-center">
              <span className="text-success text-sm font-bold">Wins</span>
              <span className="text-2xl text-success font-bold">{profile.wins}</span>
            </div>
            <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
              <span className="text-content-3 text-sm font-bold">Draws</span>
              <span className="text-2xl text-content-2 font-bold">{profile.draws}</span>
            </div>
            <div className="bg-error/10 p-4 rounded-lg border border-error/20 flex flex-col items-center">
              <span className="text-error text-sm font-bold">Losses</span>
              <span className="text-2xl text-error font-bold">{profile.losses}</span>
            </div>
          </div>
          
          {/* We will add RatingGraph here later */}
          
        </div>
      </div>
    </div>
  );
};
