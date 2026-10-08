import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useToast } from './Toast';
import { User, Save, Clock, LogOut, ArrowLeft, ShieldCheck, Mail } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface ProfileAreaProps {
  onExit: () => void;
  onViewProfile?: (username: string) => void;
  onProfileUpdate?: () => void;
}

export const ProfileArea: React.FC<ProfileAreaProps> = ({ onExit, onViewProfile, onProfileUpdate }) => {
  const { user } = useAuth();
  const { profile, loading, updateUsername, updateAvatar, uploadAvatar } = useProfile();
  const { addToast } = useToast();
  
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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
        <h2 className="text-2xl font-bold text-content-1">Not logged in</h2>
        <Button onClick={onExit}>Return to Game</Button>
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
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-content-1 mb-1 min-h-[36px] flex items-center break-all">
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input 
                    type="text" 
                    defaultValue={profile?.avatar_url || ''}
                    placeholder="https://example.com/avatar.png"
                    onBlur={async (e) => {
                      const url = e.target.value.trim();
                      if (url !== profile?.avatar_url) {
                        setSaving(true);
                        const { success, error } = await updateAvatar(url);
                        if (success) addToast('Avatar updated', 'success');
                        else addToast(`Error: ${error}`, 'error');
                        setSaving(false);
                      }
                    }}
                  />
                </div>
                <div className="shrink-0 text-content-3 font-medium">OR</div>
                <Button 
                  variant="secondary" 
                  className="shrink-0 relative overflow-hidden"
                  disabled={saving}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
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
                  Upload File
                </Button>
              </div>
              <p className="text-xs text-content-3">Paste an image URL or upload a file directly.</p>
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
                <span className="text-2xl text-content-1 font-bold">{profile?.highest_rating || 100}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Bullet</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating_bullet || 100}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Blitz</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating_blitz || 100}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Rapid</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.rating_rapid || 100}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Highest Overall</span>
                <span className="text-2xl text-warning font-bold">{profile?.highest_rating || 100}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Games</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.games_played || 0}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Longest Streak</span>
                <span className="text-2xl text-success font-bold">{profile?.longest_win_streak || 0}</span>
              </div>
              <div className="bg-surface-3 p-4 rounded-lg border border-border-1 flex flex-col items-center">
                <span className="text-content-3 text-xs uppercase tracking-wider font-bold">Puzzles</span>
                <span className="text-2xl text-content-1 font-bold">{profile?.puzzle_rating || 100}</span>
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
