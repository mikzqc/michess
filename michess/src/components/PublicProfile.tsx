import React from 'react';
import { User, ArrowLeft, ShieldCheck, Swords, UserPlus } from 'lucide-react';
import { usePublicProfile } from '../hooks/usePublicProfile';

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
        <div className="w-12 h-12 border-4 border-chess-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 mt-20 animate-fade-in">
        <p className="text-slate-400">Profile not found.</p>
        <button onClick={onExit} className="px-6 py-2 bg-slate-800 rounded-lg text-white font-bold">
          Back
        </button>
      </div>
    );
  }

  const winRate = profile.games_played > 0 
    ? Math.round((profile.wins / profile.games_played) * 100) 
    : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 animate-fade-in mt-10">
      <button 
        onClick={onExit}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 font-medium"
      >
        <ArrowLeft size={20} /> Back
      </button>

      <div className="bg-chess-panel border border-chess-border rounded-xl p-8 relative overflow-hidden shadow-2xl animate-slide-up">
        
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 overflow-hidden shadow-lg">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-slate-400" />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {profile.username}
              </h1>
              <div className="flex items-center gap-3">
                <span className="bg-chess-accent/20 text-indigo-300 px-3 py-1 rounded-full font-bold text-sm border border-chess-accent/30">
                  {profile.rating} ELO
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-900/30 px-3 py-1 rounded-full text-sm border border-emerald-900/50 flex items-center gap-1">
                  <ShieldCheck size={14} /> Active
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
              onClick={() => onChallenge(profile.id)}
              className="flex items-center justify-center gap-2 bg-chess-accent hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg"
            >
              <Swords size={20} /> Challenge
            </button>
            <button 
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg"
            >
              <UserPlus size={20} /> Add Friend
            </button>
          </div>
        </div>

        <div className="space-y-8 pt-6 border-t border-slate-700/50">
          
          <h2 className="text-2xl font-bold text-white mb-4">Player Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-sm font-bold mb-1">Highest Rating</span>
              <span className="text-3xl text-amber-400 font-black">{profile.highest_rating || 1200}</span>
            </div>
            <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-sm font-bold mb-1">Win Rate</span>
              <span className="text-3xl text-white font-black">{winRate}%</span>
            </div>
            <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-sm font-bold mb-1">Total Games</span>
              <span className="text-3xl text-white font-black">{profile.games_played}</span>
            </div>
            <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-sm font-bold mb-1">Win Streak</span>
              <span className="text-3xl text-emerald-400 font-black">{profile.current_streak}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-900/50 flex flex-col items-center">
              <span className="text-emerald-400 text-sm font-bold">Wins</span>
              <span className="text-2xl text-emerald-500 font-bold">{profile.wins}</span>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col items-center">
              <span className="text-slate-400 text-sm font-bold">Draws</span>
              <span className="text-2xl text-slate-300 font-bold">{profile.draws}</span>
            </div>
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-900/50 flex flex-col items-center">
              <span className="text-red-400 text-sm font-bold">Losses</span>
              <span className="text-2xl text-red-500 font-bold">{profile.losses}</span>
            </div>
          </div>
          
          {/* We will add RatingGraph here later */}
          
        </div>
      </div>
    </div>
  );
};
