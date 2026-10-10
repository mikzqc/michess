import React from 'react';
import { Ban, Clock, LifeBuoy } from 'lucide-react';
import type { UserProfile } from '../hooks/useProfile';

interface AccountRestrictionBannerProps {
  profile: UserProfile | null;
  onOpenSupport?: () => void;
}

export const AccountRestrictionBanner: React.FC<AccountRestrictionBannerProps> = ({
  profile,
  onOpenSupport
}) => {
  if (!profile) return null;

  const isBanned = profile.is_banned;
  const isSuspended = profile.suspended_until && new Date(profile.suspended_until) > new Date();

  if (!isBanned && !isSuspended) return null;

  return (
    <div className="bg-red-950/80 border-b border-red-900/80 text-white px-4 py-3 shadow-md z-40 relative animate-fade-in">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-900/60 text-red-300 border border-red-700/50 shrink-0">
            {isBanned ? <Ban size={18} /> : <Clock size={18} />}
          </div>
          <div>
            <h4 className="font-bold text-red-200">
              {isBanned ? 'Account Restricted / Banned' : 'Account Temporarily Suspended'}
            </h4>
            <p className="text-red-300 text-xs mt-0.5">
              {isBanned ? (
                <>Your account is permanently restricted from online matchmaking and messaging. Reason: <em>"{profile.banned_reason || 'Violation of community guidelines'}"</em>.</>
              ) : (
                <>Your account is suspended until <strong>{new Date(profile.suspended_until!).toLocaleString()}</strong>. Reason: <em>"{profile.suspension_reason || 'Disciplinary violation'}"</em>.</>
              )}
            </p>
          </div>
        </div>

        {onOpenSupport && (
          <button
            onClick={onOpenSupport}
            className="px-3 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-100 font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer border border-red-700/60"
          >
            <LifeBuoy size={14} />
            <span>Appeal / Support</span>
          </button>
        )}
      </div>
    </div>
  );
};
