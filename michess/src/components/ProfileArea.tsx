import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useToast } from './Toast';
import { User, Save, Clock, LogOut, ArrowLeft, ShieldCheck, Mail, Upload } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface ProfileAreaProps {
  onExit: () => void;
  onViewProfile?: (username: string) => void;
  onProfileUpdate?: () => void;
  onRequireAuth?: () => void;
}

export const ProfileArea: React.FC<ProfileAreaProps> = ({ onExit, onViewProfile, onProfileUpdate, onRequireAuth }) => {
  const { user } = useAuth();
  const { profile, loading, updateUsername, uploadAvatar } = useProfile();
  const { addToast } = useToast();
  
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const winRate = profile?.games_played ? Math.round(((profile.wins || 0) / profile.games_played) * 100) : 0;

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      addToast('Logged out successfully', 'info');
    }
    onExit();
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      addToast('Username cannot be empty', 'error');
      return;
    }
    
    setSaving(true);
    const { success, error } = await updateUsername(newUsername.trim());
    if (success) {
      addToast('Username updated successfully!', 'success');
      setIsEditing(false);
      setNewUsername('');
      if (onProfileUpdate) onProfileUpdate();
    } else {
      addToast(`Error: ${error}`, 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 mt-20">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 mt-20 gap-4">
        <User size={48} className="text-content-3" />
        <h2 className="text-2xl font-bold text-content-1">Sign in to view your profile</h2>
        <div className="flex items-center gap-3">
          {onRequireAuth && (
            <Button onClick={onRequireAuth} variant="primary">Sign In / Register</Button>
          )}
          <Button onClick={onExit} variant="ghost">Return to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 h-full flex flex-col py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onExit} className="pl-0">
          <ArrowLeft size={20} className="mr-2" /> Back
        </Button>
        <h2 className="text-2xl font-black text-content-1">Profile</h2>
        <div className="w-20"></div> {/* Spacer for centering */}
      </div>

      <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-8 relative overflow-hidden shadow-sm animate-slide-up">
        {/* Background decorative element */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-accent/20 to-surface-2/0 z-0"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-16 h-16 shrink-0 bg-surface-3 rounded-full flex items-center justify-center border-2 border-border-2 overflow-hidden shadow-sm">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-content-3" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-content-1 mb-1 min-h-[36px] flex items-center break-words" title={profile?.username}>
                {loading ? (
                  <div className="w-32 h-6 animate-pulse bg-content-3/30 rounded-full" />
                ) : (
                  profile?.username || 'Player'
                )}
              </h1>
              <p className="text-content-3 text-sm font-medium flex items-center gap-1 truncate">
                <Mail size={14} className="shrink-0" /> <span className="truncate">{user.email}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
            {onViewProfile && profile?.username && (
              <Button 
                variant="primary"
                onClick={() => onViewProfile(profile.username)}
                className="w-full sm:w-auto"
              >
                <User size={16} className="mr-2" /> View Public Profile
              </Button>
            )}
            <Button 
              variant="destructive"
              onClick={handleSignOut}
              className="w-full sm:w-auto"
            >
              <LogOut size={16} className="mr-2" /> Log Out
            </Button>
          </div>
        </div>

        <div className="space-y-8 pt-6 border-t border-border-1">
          {/* Avatar Section */}
          <div className="pt-2">
            <h2 className="text-xl font-bold text-content-1 mb-4">Avatar</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button 
                variant="secondary" 
                className="relative overflow-hidden flex items-center gap-2"
                disabled={saving}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={saving}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSaving(true);
                      const { success, error } = await uploadAvatar(file);
                      if (success) addToast('Avatar uploaded successfully', 'success');
                      else addToast(`Error: ${error}`, 'error');
                      setSaving(false);
                    }
                  }}
                />
                <Upload size={16} />
                <span>{saving ? 'Uploading...' : 'Upload Avatar'}</span>
              </Button>
              <p className="text-xs text-content-3">Upload an image file (PNG, JPG, WebP) up to 5MB.</p>
            </div>
          </div>

          {/* Username Section */}
          <div className="pt-2 border-t border-border-1">
            <h2 className="text-xl font-bold text-content-1 mb-4 mt-4">Username</h2>
            
            {isEditing ? (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <Input 
                    label="New Username"
                    type="text" 
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter new username"
                    maxLength={20}
                  />
                  <p className="text-xs text-content-3 mt-2">
                    Must be 3-20 characters long. Letters, numbers, and underscores only. 
                    {profile?.username?.toLowerCase() === 'mikhaelmathews' ? (
                      <span className="text-success block mt-1">You have exactly 1 special chance to change your username without waiting 7 days.</span>
                    ) : (
                      " You can change this once every 7 days."
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveUsername}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Saving...' : <><Save size={18} className="mr-2" /> Save</>}
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => { setIsEditing(false); setNewUsername(''); }}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between animate-fade-in">
                <div>
                  <p className="text-lg text-content-1 font-medium">
                    {profile?.username ? profile.username : <span className="text-content-3 italic">No username set</span>}
                  </p>
                  {profile?.last_username_change && (
                    <p className="text-xs text-content-3 flex items-center gap-1 mt-1">
                      <Clock size={12} /> Last changed: {new Date(profile.last_username_change).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  size="sm"
                >
                  Change
                </Button>
              </div>
            )}
          </div>

          {/* Account Details & Stats */}
          <div className="flex flex-col gap-4 pt-4 border-t border-border-1">
            <h2 className="text-xl font-bold text-content-1 mb-2">Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Overall Rating</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating || profile?.highest_rating || 800}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Bullet</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating_bullet || 800}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Blitz</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating_blitz || 800}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Rapid</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating_rapid || 800}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Highest Overall</span>
                <span className="text-2xl text-warning font-bold">{profile?.highest_rating || profile?.rating || 800}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Games</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.games_played || 0}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Win Rate</span>
                <span className="text-2xl text-emerald-400 font-bold">{winRate}%</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Longest Streak</span>
                <span className="text-2xl text-success font-bold">{profile?.longest_win_streak || 0}</span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-content-1 mt-6 mb-2">Puzzles</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Rating</span>
                <span className="text-2xl text-accent font-bold">{profile?.puzzle_rating || 1200}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Solved</span>
                <span className="text-2xl text-success font-bold">{profile?.puzzles_solved || 0}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Failed</span>
                <span className="text-2xl text-error font-bold">{profile?.puzzles_failed || 0}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Best Streak</span>
                <span className="text-2xl text-warning font-bold">{profile?.puzzle_best_streak || 0}</span>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-content-1 mt-6 mb-2">Account</h2>
            <div className="flex justify-between items-center p-4 bg-surface-3 rounded-lg border border-border-1">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-success" size={20} />
                <span className="text-content-2 font-medium">Account Status</span>
              </div>
              <span className="text-success font-bold bg-success/10 px-3 py-1 rounded-full text-sm">
                Active
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-surface-3 rounded-lg border border-border-1">
              <div className="flex items-center gap-3">
                <User className="text-content-3" size={20} />
                <span className="text-content-2 font-medium">Member Since</span>
              </div>
              <span className="text-content-3 font-medium">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
