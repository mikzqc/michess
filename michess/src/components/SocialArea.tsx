import React, { useState } from 'react';
import { Search, UserPlus, Check, X, User, ArrowLeft, Users } from 'lucide-react';
import { useSocial } from '../hooks/useSocial';
import { useSearch } from '../hooks/useSearch';
import { useAuth } from '../hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useToast } from './Toast';

interface SocialAreaProps {
  onExit: () => void;
  onViewProfile: (username: string) => void;
}

export const SocialArea: React.FC<SocialAreaProps> = ({ onExit, onViewProfile }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { friends, sendRequest, acceptRequest, removeFriend } = useSocial();
  const { results, loading: searchLoading, searchUsers } = useSearch();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeTab, setActiveTab] = useState<'social' | 'leaderboard'>('social');
  const [leaderboardCategory, setLeaderboardCategory] = useState<'overall' | 'bullet' | 'blitz' | 'rapid' | 'puzzle_rating' | 'games_played'>('overall');
  const { leaderboard, loading: leaderboardLoading } = useLeaderboard(leaderboardCategory);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const handleSendRequest = async (id: string) => {
    const { success, error } = await sendRequest(id);
    if (success) addToast('Friend request sent!', 'success');
    else addToast(`Error: ${error}`, 'error');
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 mt-20 animate-fade-in">
        <p className="text-content-3">Log in to view friends and leaderboards.</p>
        <button onClick={onExit} className="px-6 py-2 bg-surface-2 rounded-lg text-content-1 font-bold">
          Back
        </button>
      </div>
    );
  }

  const pendingRequests = friends.filter(f => f.status === 'pending' && f.friend_id === user.id);
  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in mt-10">
      <button 
        onClick={onExit}
        className="flex items-center gap-2 text-content-3 hover:text-content-1 transition-colors mb-8 font-medium"
      >
        <ArrowLeft size={20} /> Back
      </button>

      <div className="flex border-b border-border-1 gap-6 mb-6">
        {(['social', 'leaderboard'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 font-bold text-lg capitalize transition-colors ${
              activeTab === tab 
                ? 'border-b-2 border-accent text-accent' 
                : 'text-content-3 hover:text-content-2'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'social' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Friends */}
          <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-content-1 mb-6 flex items-center gap-2">
              <Users className="text-accent" /> Friends
            </h2>

            {pendingRequests.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-content-3 uppercase tracking-wider mb-3">Pending Requests</h3>
                <div className="space-y-3">
                  {pendingRequests.map(req => (
                    <div key={req.user_id} className="bg-surface-1/50 p-3 rounded-lg border border-border-1 flex justify-between items-center">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(req.friend_profile!.username)}>
                        <div className="w-10 h-10 bg-surface-2 rounded-full flex items-center justify-center overflow-hidden">
                          {req.friend_profile?.avatar_url ? (
                            <img src={req.friend_profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} className="text-content-3" />
                          )}
                        </div>
                        <span className="font-bold text-content-1">{req.friend_profile?.username}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptRequest(req.user_id)} className="p-2 bg-emerald-900/50 hover:bg-emerald-800/80 text-success rounded-lg transition-colors">
                          <Check size={18} />
                        </button>
                        <button onClick={() => removeFriend(req.user_id)} className="p-2 bg-error/20 hover:bg-red-800/80 text-error rounded-lg transition-colors">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-content-3 uppercase tracking-wider mb-3">Your Friends</h3>
              {acceptedFriends.length === 0 ? (
                <p className="text-content-3 italic">No friends yet. Search for players to add them!</p>
              ) : (
                <div className="space-y-3">
                  {acceptedFriends.map(friend => (
                    <div key={friend.user_id === user.id ? friend.friend_id : friend.user_id} className="bg-surface-1/50 p-3 rounded-lg border border-border-1 flex justify-between items-center group">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(friend.friend_profile!.username)}>
                        <div className="w-10 h-10 bg-surface-2 rounded-full flex items-center justify-center overflow-hidden">
                          {friend.friend_profile?.avatar_url ? (
                            <img src={friend.friend_profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} className="text-content-3" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-content-1 block">{friend.friend_profile?.username}</span>
                          <span className="text-xs text-content-3">{friend.friend_profile?.rating} ELO</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFriend(friend.user_id === user.id ? friend.friend_id : friend.user_id)} 
                        className="p-2 text-content-3 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove Friend"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Search */}
          <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-content-1 mb-6 flex items-center gap-2">
              <Search className="text-accent" /> Find Players
            </h2>
            
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search usernames..."
                className="flex-1 bg-surface-1 border border-border-1 rounded-lg px-4 py-2 text-content-1 focus:outline-none focus:border-accent transition-colors"
              />
              <button 
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent/80 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {searchLoading ? '...' : 'Search'}
              </button>
            </form>

            <div className="space-y-3">
              {results.map(res => {
                if (res.id === user.id) return null;
                
                const isPending = pendingRequests.some(r => r.user_id === res.id) || friends.some(f => f.status === 'pending' && f.user_id === user.id && f.friend_id === res.id);
                const isFriend = acceptedFriends.some(f => f.user_id === res.id || f.friend_id === res.id);
                
                return (
                  <div key={res.id} className="bg-surface-1/50 p-3 rounded-lg border border-border-1 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(res.username)}>
                      <div className="w-10 h-10 bg-surface-2 rounded-full flex items-center justify-center overflow-hidden">
                        {res.avatar_url ? (
                          <img src={res.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={20} className="text-content-3" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-content-1 block">{res.username}</span>
                        <span className="text-xs text-content-3 uppercase tracking-wider font-bold">
                          {res.rating} ELO
                        </span>
                      </div>
                    </div>
                    
                    {!isFriend && !isPending && (
                      <button 
                        onClick={() => handleSendRequest(res.id)}
                        className="p-2 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-bold"
                      >
                        <UserPlus size={16} /> Add
                      </button>
                    )}
                    {isPending && <span className="text-xs font-bold text-content-3 uppercase tracking-wider px-2">Pending</span>}
                    {isFriend && <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider px-2">Friends</span>}
                  </div>
                );
              })}
              {results.length === 0 && searchQuery && !searchLoading && (
                <p className="text-content-3 italic text-center py-4">No players found.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-content-1 flex items-center gap-2">
              🏆 Leaderboard
            </h2>
            <select
              value={leaderboardCategory}
              onChange={(e) => setLeaderboardCategory(e.target.value as any)}
              className="bg-surface-1 border border-border-1 rounded-lg px-4 py-2 text-content-1 focus:outline-none focus:border-accent"
            >
              <option value="overall">Overall Rating</option>
              <option value="bullet">Bullet Rating</option>
              <option value="blitz">Blitz Rating</option>
              <option value="rapid">Rapid Rating</option>
              <option value="puzzle_rating">Puzzle Rating</option>
              <option value="games_played">Games Played</option>
            </select>
          </div>

          {leaderboardLoading ? (
            <div className="text-center py-8 text-content-3 italic">Loading rankings...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-1 text-content-3 text-xs uppercase tracking-wider">
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Player</th>
                    <th className="p-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, index) => {
                    let score = p.rating;
                    if (leaderboardCategory === 'bullet') score = p.rating_bullet;
                    else if (leaderboardCategory === 'blitz') score = p.rating_blitz;
                    else if (leaderboardCategory === 'rapid') score = p.rating_rapid;
                    else if (leaderboardCategory === 'puzzle_rating') score = p.puzzle_rating;
                    else if (leaderboardCategory === 'games_played') score = p.games_played;

                    return (
                      <tr key={p.id} className="border-b border-border-1/50 hover:bg-surface-3 transition-colors">
                        <td className="p-3 text-center font-bold text-content-3">
                          {index + 1}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(p.username)}>
                            <div className="w-8 h-8 bg-surface-1 rounded-full flex items-center justify-center overflow-hidden border border-border-1 shrink-0">
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User size={16} className="text-content-3" />
                              )}
                            </div>
                            <span className="font-bold text-content-1">{p.username}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-accent">
                          {score || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
