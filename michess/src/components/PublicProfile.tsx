import React, { useState } from 'react';
import { User, ArrowLeft, ShieldCheck, Swords, Zap, Clock, Target, Trophy, Medal } from 'lucide-react';
import { usePublicProfile } from '../hooks/usePublicProfile';
import { usePublicHistory } from '../hooks/usePublicHistory';
import { useStatistics } from '../hooks/useStatistics';
import { useAchievements } from '../hooks/useAchievements';
import { OpeningExplorer } from './OpeningExplorer';
import { Button } from './ui/Button';

interface PublicProfileProps {
  username: string;
  onExit: () => void;
  onChallenge: (userId: string) => void;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ username, onExit, onChallenge }) => {
  const { profile, loading: profileLoading, error } = usePublicProfile(username);
  const { history, loading: historyLoading } = usePublicHistory(profile?.id);
  const { stats, openingStats } = useStatistics(history, username);
  const { achievements, loading: achievementsLoading } = useAchievements(profile?.id);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'openings' | 'achievements'>('overview');

  if (profileLoading) {
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
        <Button onClick={onExit}>Back</Button>
      </div>
    );
  }

  const winRate = profile.games_played > 0 
    ? Math.round((profile.wins / profile.games_played) * 100) 
    : 0;

  const unlockedAchievements = achievements.filter(a => a.unlocked_at);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in mt-10">
      <Button variant="ghost" onClick={onExit} className="mb-8 pl-0">
        <ArrowLeft size={20} className="mr-2" /> Back
      </Button>

      <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-8 relative overflow-hidden shadow-sm animate-slide-up mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-surface-3 rounded-full flex items-center justify-center border-4 border-border-2 overflow-hidden shadow-sm shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-content-3" />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-bold text-content-1 mb-2">{profile.username}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-accent/10 text-accent px-3 py-1 rounded-full font-bold text-sm border border-accent/20">
                  {profile.rating} ELO
                </span>
                <span className="text-success font-bold bg-success/10 px-3 py-1 rounded-full text-sm border border-success/20 flex items-center gap-1">
                  <ShieldCheck size={14} /> Active
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => onChallenge(profile.id)}>
              <Swords size={18} className="mr-2" /> Challenge
            </Button>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex border-b border-border-1 gap-6 mb-6 overflow-x-auto relative z-10">
          {(['overview', 'stats', 'openings', 'achievements'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 font-bold text-sm capitalize transition-colors whitespace-nowrap ${
                activeTab === tab 
                  ? 'border-b-2 border-accent text-accent' 
                  : 'text-content-3 hover:text-content-2'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in relative z-10">
            {/* Ratings Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-3 border border-border-1 rounded-lg p-4 flex flex-col items-center">
                <span className="text-content-3 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={12}/> Bullet</span>
                <span className="text-2xl text-content-1 font-bold">{profile.rating_bullet || 100}</span>
              </div>
              <div className="bg-surface-3 border border-border-1 rounded-lg p-4 flex flex-col items-center">
                <span className="text-content-3 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={12}/> Blitz</span>
                <span className="text-2xl text-content-1 font-bold">{profile.rating_blitz || 100}</span>
              </div>
              <div className="bg-surface-3 border border-border-1 rounded-lg p-4 flex flex-col items-center">
                <span className="text-content-3 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Rapid</span>
                <span className="text-2xl text-content-1 font-bold">{profile.rating_rapid || 100}</span>
              </div>
              <div className="bg-surface-3 border border-border-1 rounded-lg p-4 flex flex-col items-center">
                <span className="text-content-3 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Target size={12}/> Puzzles</span>
                <span className="text-2xl text-content-1 font-bold">{profile.puzzle_rating || 100}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-surface-3 border border-border-1 rounded-lg p-6 flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 mb-4">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path
                      className="text-surface-1"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={winRate > 50 ? "text-emerald-500" : "text-accent"}
                      strokeWidth="3"
                      strokeDasharray={`${winRate}, 100`}
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-content-1">{winRate}%</span>
                    <span className="text-xs text-content-3 uppercase tracking-wider font-bold">Win Rate</span>
                  </div>
                </div>
                <div className="w-full flex justify-between text-sm font-bold mt-4">
                  <span className="text-emerald-500">{profile.wins} W</span>
                  <span className="text-content-3">{profile.draws} D</span>
                  <span className="text-rose-500">{profile.losses} L</span>
                </div>
              </div>

              <div className="md:col-span-2 bg-surface-3 border border-border-1 rounded-lg p-6">
                <h3 className="text-content-1 font-bold mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-warning" /> Personal Records
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-2 p-3 rounded border border-border-1">
                    <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Highest Rating</p>
                    <p className="text-xl font-bold text-content-1">{profile.highest_rating}</p>
                  </div>
                  <div className="bg-surface-2 p-3 rounded border border-border-1">
                    <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Longest Win Streak</p>
                    <p className="text-xl font-bold text-content-1">{profile.longest_win_streak || 0}</p>
                  </div>
                  <div className="bg-surface-2 p-3 rounded border border-border-1">
                    <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Games Played</p>
                    <p className="text-xl font-bold text-content-1">{profile.games_played}</p>
                  </div>
                  <div className="bg-surface-2 p-3 rounded border border-border-1">
                    <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Longest Game</p>
                    <p className="text-xl font-bold text-content-1">{profile.longest_game_moves || 0} moves</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-fade-in relative z-10">
            {historyLoading ? (
              <p className="text-content-3 italic">Loading advanced statistics...</p>
            ) : history.length === 0 ? (
              <p className="text-content-3 italic">No games played yet to generate statistics.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-3 p-4 rounded-lg border border-border-1">
                  <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Avg Accuracy</p>
                  <p className="text-2xl font-bold text-content-1">{stats.avgAccuracy}%</p>
                </div>
                <div className="bg-surface-3 p-4 rounded-lg border border-border-1">
                  <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Total Blunders</p>
                  <p className="text-2xl font-bold text-rose-500">{stats.totalBlunders}</p>
                </div>
                <div className="bg-surface-3 p-4 rounded-lg border border-border-1">
                  <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Total Mistakes</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.totalMistakes}</p>
                </div>
                <div className="bg-surface-3 p-4 rounded-lg border border-border-1">
                  <p className="text-xs text-content-3 font-bold uppercase tracking-wider mb-1">Common Result</p>
                  <p className="text-lg font-bold text-content-1 mt-1">{stats.mostCommonResult}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OPENINGS TAB */}
        {activeTab === 'openings' && (
          <div className="space-y-6 animate-fade-in relative z-10">
            {historyLoading ? (
              <p className="text-content-3 italic">Loading openings...</p>
            ) : history.length === 0 ? (
              <p className="text-content-3 italic">No games played yet to generate opening statistics.</p>
            ) : (
              <>
                <div className="bg-surface-3 border border-border-1 rounded-lg overflow-hidden">
                  <div className="p-4 bg-surface-2 border-b border-border-1 font-bold text-content-1">
                    Top Openings Played
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border-1 text-content-3 text-xs uppercase tracking-wider">
                        <th className="p-3">Opening</th>
                        <th className="p-3">Games</th>
                        <th className="p-3">Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openingStats.slice(0, 5).map(o => (
                        <tr key={o.name} className="border-b border-border-1/50">
                          <td className="p-3 font-medium text-content-1">{o.name}</td>
                          <td className="p-3 text-content-2">{o.games}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              o.winRate > 50 ? 'bg-emerald-500/20 text-emerald-400' :
                              o.winRate < 40 ? 'bg-rose-500/20 text-rose-400' :
                              'bg-surface-3 text-content-2'
                            }`}>
                              {o.winRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <OpeningExplorer history={history} targetPlayerName={username} />
              </>
            )}
          </div>
        )}

        {/* ACHIEVEMENTS TAB */}
        {activeTab === 'achievements' && (
          <div className="space-y-6 animate-fade-in relative z-10">
            {achievementsLoading ? (
              <p className="text-content-3 italic">Loading achievements...</p>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Medal className="text-warning" size={20} />
                  <h3 className="text-lg font-bold text-content-1">Unlocked Badges ({unlockedAchievements.length})</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {achievements.map(a => (
                    <div 
                      key={a.id} 
                      className={`p-4 rounded-lg border flex gap-3 ${
                        a.unlocked_at 
                          ? 'bg-surface-3 border-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                          : 'bg-surface-2 border-border-1 opacity-60 grayscale'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        a.unlocked_at ? 'bg-accent/20 text-accent' : 'bg-surface-1 text-content-3'
                      }`}>
                        <Trophy size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-content-1 text-sm">{a.name}</h4>
                        <p className="text-xs text-content-3">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
