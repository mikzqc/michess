import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useToast } from './Toast';
import { User, Save, Clock, LogOut, ArrowLeft, ShieldCheck, Mail } from 'lucide-react';
import { supabase } from '../services/supabase';

interface ProfileAreaProps {
  onExit: () => void;
}

export const ProfileArea: React.FC<ProfileAreaProps> = ({ onExit }) => {
  const { user } = useAuth();
  const { profile, loading, updateUsername } = useProfile();
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
    } else {
      addToast(`Error: ${error}`, 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 mt-20">
        <div className="w-12 h-12 border-4 border-chess-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 mt-20 animate-fade-in">
        <p className="text-slate-400">You are not logged in.</p>
        <button onClick={onExit} className="px-6 py-2 bg-slate-800 rounded-lg text-white font-bold">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 animate-fade-in mt-10">
      <button 
        onClick={onExit}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 font-medium"
      >
        <ArrowLeft size={20} /> Back to Dashboard
      </button>

      <div className="bg-chess-panel border border-chess-border rounded-xl p-8 relative overflow-hidden shadow-2xl animate-slide-up">

        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700">
              <User size={32} className="text-slate-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {profile?.username || 'Player'}
              </h1>
              <p className="text-slate-400 text-sm font-medium flex items-center gap-1">
                <Mail size={14} /> {user.email}
              </p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg font-bold transition-colors w-full md:w-auto"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>

        <div className="space-y-8 pt-6 border-t border-slate-700/50">
          {/* Username Section */}
          <div className="pt-2">
            <h2 className="text-xl font-bold text-white mb-4">Username</h2>
            
            {isEditing ? (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">New Username</label>
                  <input 
                    type="text" 
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter new username"
                    maxLength={20}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-chess-accent font-medium"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Must be 3-20 characters long. Letters, numbers, and underscores only. 
                    {profile?.username?.toLowerCase() === 'mikhaelmathews' ? (
                      <span className="text-emerald-400 block mt-1">You have exactly 1 special chance to change your username without waiting 7 days.</span>
                    ) : (
                      " You can change this once every 7 days."
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveUsername}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-chess-accent hover:bg-indigo-500 text-white p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : <><Save size={18} /> Save</>}
                  </button>
                  <button 
                    onClick={() => { setIsEditing(false); setNewUsername(''); }}
                    disabled={saving}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between animate-fade-in">
                <div>
                  <p className="text-lg text-white font-medium">
                    {profile?.username ? profile.username : <span className="text-slate-500 italic">No username set</span>}
                  </p>
                  {profile?.last_username_change && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock size={12} /> Last changed: {new Date(profile.last_username_change).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Account Details */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-emerald-500" size={20} />
                <span className="text-slate-300 font-medium">Account Status</span>
              </div>
              <span className="text-emerald-400 font-bold bg-emerald-900/30 px-3 py-1 rounded-full text-sm">
                Active
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <User className="text-slate-400" size={20} />
                <span className="text-slate-300 font-medium">Member Since</span>
              </div>
              <span className="text-slate-400 font-medium">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
