import React, { useState, useEffect } from 'react';
import { Skull, LogOut, FileText, AlertTriangle, ShieldAlert, CheckCircle2, Send, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import type { UserProfile } from '../hooks/useProfile';
import { Button } from './ui/Button';

interface BannedLockScreenProps {
  profile: UserProfile;
  onSignOut: () => Promise<void> | void;
}

export const BannedLockScreen: React.FC<BannedLockScreenProps> = ({ profile, onSignOut }) => {
  const isBanned = !!profile?.is_banned;
  const isSuspended = !!(profile?.suspended_until && !isNaN(new Date(profile.suspended_until).getTime()) && new Date(profile.suspended_until) > new Date());

  // Countdown timer for suspensions
  const [timeLeft, setTimeLeft] = useState<string>('');
  useEffect(() => {
    if (!isSuspended || !profile?.suspended_until) return;

    const updateTimer = () => {
      const d = new Date(profile.suspended_until!);
      if (isNaN(d.getTime())) {
        setTimeLeft('Active');
        return;
      }
      const diff = d.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired (refresh page)');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
      setTimeLeft(parts.join(' '));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isSuspended, profile?.suspended_until]);

  // Appeal Modal State
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealText.trim() || !supabase) return;

    setSubmittingAppeal(true);
    setAppealError(null);

    try {
      let resolvedId: string | undefined = profile?.id;
      if (!resolvedId) {
        const { data: authData } = await supabase.auth.getUser();
        resolvedId = authData.user?.id;
      }
      if (!resolvedId) throw new Error('Account identification not found.');
      const finalUserId: string = resolvedId;

      const { error } = await supabase.from('message_reports').insert({
        reporter_id: finalUserId,
        reported_user_id: finalUserId,
        message_type: 'appeal',
        reason: isBanned ? 'Ban Appeal' : 'Suspension Appeal',
        details: appealText.trim(),
        status: 'pending'
      });

      if (error) throw error;
      setAppealSubmitted(true);
      setShowAppealModal(false);
    } catch (err: any) {
      setAppealError(err.message || 'Failed to submit appeal. Please try again later.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const enforcementTimeStr = (() => {
    if (profile?.banned_at) {
      const d = new Date(profile.banned_at);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return new Date().toLocaleString();
  })();

  return (
    <div className="fixed inset-0 z-[99999] bg-[#050000] text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
      {/* Ominous radial crimson glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/40 via-red-950/15 to-[#050000] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.5)_51%)] bg-[length:100%_4px] opacity-35 pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full my-auto flex flex-col items-center text-center">
        {/* Sinister Icon */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-red-600/25 rounded-full blur-xl animate-pulse" />
          <div className="w-24 h-24 rounded-3xl bg-red-950/90 border-2 border-red-600/80 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.7)] relative">
            {isBanned ? (
              <Skull size={56} className="text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,1)]" />
            ) : (
              <ShieldAlert size={56} className="text-amber-500 animate-pulse drop-shadow-[0_0_15px_rgba(245,158,11,1)]" />
            )}
          </div>
        </div>

        {/* Hazard Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/90 border border-red-500/60 text-red-400 font-mono text-xs uppercase tracking-widest font-black mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <AlertTriangle size={14} className="text-red-500" />
          <span>{isBanned ? 'ACCESS TERMINATED • PERMANENT BAN' : 'ACCOUNT QUARANTINE • SUSPENDED'}</span>
        </div>

        {/* Terrifying Main Heading */}
        <h1 className="text-4xl sm:text-6xl font-black font-mono tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-red-200 to-red-600 drop-shadow-[0_0_25px_rgba(220,38,38,0.7)] mb-3">
          {isBanned ? 'YOU ARE BANNED' : 'ACCOUNT SUSPENDED'}
        </h1>

        <p className="text-red-300 text-sm sm:text-base max-w-md font-medium mb-6 leading-relaxed">
          {isBanned ? (
            'Your account has been permanently excluded from Michess. All privileges, matchmaking, and communications have been terminated.'
          ) : (
            <>Your access has been temporarily revoked. Your suspension will lift in <span className="font-mono text-amber-300 font-bold">{timeLeft}</span>.</>
          )}
        </p>

        {/* Detailed Violation Dossier Card */}
        <div className="w-full bg-[#0d0202]/95 border-2 border-red-900/80 rounded-2xl p-5 sm:p-6 text-left mb-6 shadow-[0_0_40px_rgba(153,27,27,0.3)] backdrop-blur-md">
          <div className="border-b border-red-900/50 pb-3 mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              SANCTION ENFORCEMENT RECORD
            </span>
            <span className="font-mono text-[11px] text-content-3">
              ID: {profile?.id ? profile.id.slice(0, 13) : (profile?.username || 'ACCOUNT')}...
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-red-950/60">
              <span className="text-red-400/80 font-bold uppercase">TARGET USER:</span>
              <span className="text-white font-bold tracking-wide">{profile?.username || 'Current User'}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-red-950/60">
              <span className="text-red-400/80 font-bold uppercase">PUNISHMENT:</span>
              <span className="text-red-400 font-bold">
                {isBanned ? 'PERMANENT EXCLUSION' : `TEMPORARY SUSPENSION (${timeLeft || 'Active'})`}
              </span>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-red-950/60">
              <span className="text-red-400/80 font-bold uppercase">REASON FOR ACTION:</span>
              <p className="text-red-200 bg-red-950/50 border border-red-900/40 rounded-lg p-2.5 italic font-sans text-xs mt-1">
                "{isBanned ? (profile?.banned_reason || 'Severe violation of fair play and community standards') : (profile?.suspension_reason || 'Temporary disciplinary measure')}"
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-red-400/80 font-bold uppercase">TIME OF ENFORCEMENT:</span>
              <span className="text-content-3">
                {enforcementTimeStr}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-red-900/50 text-[11px] text-red-300/80 leading-normal">
            <strong>SYSTEM NOTICE:</strong> You cannot challenge opponents, enter matchmaking, send messages, or perform any platform actions. Any attempt to bypass this lock using alternate accounts or scripts will result in an immediate hardware and IP network blacklist.
          </div>
        </div>

        {/* Status of Appeal */}
        {appealSubmitted && (
          <div className="w-full mb-6 p-4 rounded-xl bg-green-950/40 border border-green-500/50 text-green-300 text-xs flex items-center gap-3 animate-fade-in shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <CheckCircle2 size={20} className="text-green-400 shrink-0" />
            <div>
              <p className="font-bold">Appeal Submitted Successfully</p>
              <p className="text-[11px] text-green-400/80 mt-0.5">
                Your appeal ticket is currently under review by the Michess Moderation Team. You may now log out while your case is being reviewed.
              </p>
            </div>
          </div>
        )}

        {/* Actions - Strictly Log Out or Appeal */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="destructive"
            onClick={onSignOut}
            className="w-full flex-1 py-3 text-sm font-bold bg-red-900/80 hover:bg-red-800 text-white border border-red-600/50 cursor-pointer shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            <LogOut size={16} className="mr-2" /> Log Out
          </Button>

          {!appealSubmitted ? (
            <Button
              variant="secondary"
              onClick={() => setShowAppealModal(true)}
              className="w-full flex-1 py-3 text-sm font-bold bg-surface-2 hover:bg-surface-3 text-red-200 border border-red-900/60 cursor-pointer"
            >
              <FileText size={16} className="mr-2 text-red-400" /> Submit Appeal
            </Button>
          ) : (
            <div className="w-full flex-1 py-3 px-4 rounded-lg bg-surface-2/60 border border-border-1 text-content-3 text-xs font-mono text-center">
              Appeal Pending Review
            </div>
          )}
        </div>
      </div>

      {/* Appeal Submission Modal */}
      {showAppealModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f0202] border-2 border-red-700/80 rounded-2xl w-full max-w-lg p-6 shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-scale-in text-white relative">
            <button
              onClick={() => setShowAppealModal(false)}
              className="absolute right-4 top-4 text-red-400 hover:text-white p-1 rounded-lg hover:bg-red-950 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-950 border border-red-700/60 text-red-400">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white font-mono uppercase">
                  {isBanned ? 'Appeal Permanent Ban' : 'Appeal Suspension'}
                </h3>
                <p className="text-xs text-red-300/80">
                  Submit an official petition for review by Michess Administration.
                </p>
              </div>
            </div>

            {appealError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-400" />
                <span>{appealError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAppeal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-red-200 uppercase tracking-wider mb-2 font-mono">
                  Explanation & Statement of Defense:
                </label>
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Explain clearly and respectfully why this punishment should be reconsidered or overturned..."
                  rows={5}
                  maxLength={1000}
                  required
                  disabled={submittingAppeal}
                  className="w-full bg-black/90 border border-red-900/80 rounded-xl p-3 text-sm text-white placeholder:text-red-900/80 focus:outline-none focus:border-red-500 font-sans"
                />
                <div className="flex justify-between text-[11px] text-content-3 font-mono mt-1">
                  <span>Be concise and truthful. Abusive appeals will be rejected immediately.</span>
                  <span>{appealText.length}/1000</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppealModal(false)}
                  disabled={submittingAppeal}
                  className="px-4 py-2 text-xs font-bold text-content-3 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={submittingAppeal || !appealText.trim()}
                  className="bg-red-800 hover:bg-red-700 text-white font-bold text-xs px-5 py-2 cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                >
                  {submittingAppeal ? (
                    'Transmitting...'
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Send size={14} /> Send Appeal
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
