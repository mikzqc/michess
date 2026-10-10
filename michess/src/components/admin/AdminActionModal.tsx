import React, { useState } from 'react';
import { 
  AlertTriangle, ShieldAlert, Ban, Clock, CheckCircle2, 
  X, AlertCircle, UserCheck 
} from 'lucide-react';
import { Button } from '../ui/Button';

export type AdminActionKind = 
  | 'warn_user'
  | 'suspend_user'
  | 'ban_user'
  | 'unban_user'
  | 'dismiss_report'
  | 'warn_reporter';

interface AdminActionModalProps {
  isOpen: boolean;
  actionKind: AdminActionKind;
  targetUsername: string;
  targetUserId: string;
  reportId?: string;
  onClose: () => void;
  onSubmit: (data: {
    actionKind: AdminActionKind;
    reason: string;
    durationHours?: number;
    details?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

const REPORTER_ABUSE_REASONS = [
  'Deliberately false report',
  'Report submitted to harass another user',
  'Repeated abusive or malicious reporting',
  'Other misuse of the reporting system'
];

const USER_VIOLATION_REASONS = [
  'Harassment or abusive language in chat',
  'Hate speech, bigotry, or offensive conduct',
  'Cheating, engine assistance, or fair play violation',
  'Spamming, unsolicited advertising, or flooding',
  'Unsportsmanlike conduct or intentional stalling',
  'Account impersonation or suspicious activity',
  'Other community guideline violation'
];

const SUSPENSION_DURATIONS = [
  { label: '24 Hours (1 Day)', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days (1 Week)', hours: 168 },
  { label: '14 Days (2 Weeks)', hours: 336 },
  { label: '30 Days (1 Month)', hours: 720 }
];

export const AdminActionModal: React.FC<AdminActionModalProps> = ({
  isOpen,
  actionKind,
  targetUsername,
  targetUserId,
  reportId,
  onClose,
  onSubmit
}) => {
  const [selectedReason, setSelectedReason] = useState(() => {
    if (actionKind === 'warn_reporter') return REPORTER_ABUSE_REASONS[0];
    return USER_VIOLATION_REASONS[0];
  });
  const [customDetails, setCustomDetails] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getTitleAndIcon = () => {
    switch (actionKind) {
      case 'warn_user':
        return {
          title: `Warn User: ${targetUsername}`,
          icon: <AlertTriangle className="text-amber-400" size={20} />,
          badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        };
      case 'suspend_user':
        return {
          title: `Suspend User: ${targetUsername}`,
          icon: <Clock className="text-amber-500" size={20} />,
          badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        };
      case 'ban_user':
        return {
          title: `Permanently Ban: ${targetUsername}`,
          icon: <Ban className="text-red-500" size={20} />,
          badgeColor: 'border-red-500/30 bg-red-500/10 text-red-400'
        };
      case 'unban_user':
        return {
          title: `Restore Account: ${targetUsername}`,
          icon: <UserCheck className="text-green-500" size={20} />,
          badgeColor: 'border-green-500/30 bg-green-500/10 text-green-400'
        };
      case 'dismiss_report':
        return {
          title: 'Dismiss Report',
          icon: <CheckCircle2 className="text-content-3" size={20} />,
          badgeColor: 'border-border-1 bg-surface-3 text-content-2'
        };
      case 'warn_reporter':
        return {
          title: `Warn Reporter for Misuse: ${targetUsername}`,
          icon: <ShieldAlert className="text-red-400" size={20} />,
          badgeColor: 'border-red-500/30 bg-red-500/10 text-red-400'
        };
    }
  };

  const { title, icon, badgeColor } = getTitleAndIcon();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalReason = selectedReason === 'Other' || actionKind === 'dismiss_report' || actionKind === 'unban_user'
      ? customDetails.trim()
      : selectedReason;

    if (!finalReason) {
      setError('Please provide a reason for this administrative action.');
      return;
    }

    setSubmitting(true);
    const res = await onSubmit({
      actionKind,
      reason: finalReason,
      durationHours: actionKind === 'suspend_user' ? durationHours : undefined,
      details: customDetails.trim() || undefined
    });

    setSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Operation failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="p-4 border-b border-border-1 flex items-center justify-between bg-surface-3/50">
          <div className="flex items-center gap-2.5">
            {icon}
            <h3 className="font-bold text-content-1 text-base">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-content-3 hover:text-content-1 p-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Target account info */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${badgeColor}`}>
            <div>
              <span className="font-semibold">Target Account:</span> {targetUsername}
            </div>
            <div className="font-mono text-[11px] opacity-80">
              {reportId ? `Report #${reportId.slice(0, 8)} • ` : ''}{targetUserId.slice(0, 12)}...
            </div>
          </div>

          {/* Action explanation / warning */}
          {actionKind === 'ban_user' && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <span>
                <strong>Warning:</strong> This permanently restricts the account from logging in, matchmaking, and messaging. The ban can be reversed if needed.
              </span>
            </div>
          )}

          {actionKind === 'warn_reporter' && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Reporter Accountability:</strong> Only issue a warning if there is clear evidence of intentional bad faith or abuse. An unfounded or mistaken report should be dismissed without punishment.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Duration selection for suspensions */}
          {actionKind === 'suspend_user' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-3 mb-2">
                Suspension Duration
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full bg-surface-1 border border-border-1 rounded-lg px-3 py-2 text-content-1 text-sm focus:outline-none focus:border-accent transition-colors"
              >
                {SUSPENSION_DURATIONS.map(d => (
                  <option key={d.hours} value={d.hours} className="bg-surface-2 text-content-1">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reason selection */}
          {actionKind !== 'dismiss_report' && actionKind !== 'unban_user' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-3 mb-2">
                Primary Reason
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full bg-surface-1 border border-border-1 rounded-lg px-3 py-2 text-content-1 text-sm focus:outline-none focus:border-accent transition-colors"
              >
                {(actionKind === 'warn_reporter' ? REPORTER_ABUSE_REASONS : USER_VIOLATION_REASONS).map(r => (
                  <option key={r} value={r} className="bg-surface-2 text-content-1">
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Details / Explanation Textarea */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-content-3 mb-2">
              {actionKind === 'dismiss_report' ? 'Dismissal Reason / Notes' : 
               actionKind === 'unban_user' ? 'Reason for Restoring Access' : 
               'Additional Context & Evidence Notes (Required for custom details)'}
            </label>
            <textarea
              value={customDetails}
              onChange={(e) => setCustomDetails(e.target.value)}
              placeholder={
                actionKind === 'dismiss_report' 
                  ? 'Explain why this report is being dismissed (e.g. insufficient evidence, misunderstanding)...'
                  : actionKind === 'warn_reporter'
                  ? 'Detail why this report was identified as false or malicious...'
                  : 'Add any specific context, messages, or notes...'
              }
              rows={3}
              maxLength={500}
              className="w-full bg-surface-1 border border-border-1 rounded-lg p-3 text-content-1 text-sm placeholder:text-content-3 focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-1/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={actionKind === 'ban_user' || actionKind === 'warn_reporter' ? 'destructive' : 'primary'}
              disabled={submitting}
            >
              {submitting ? 'Applying...' : 'Confirm Action'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
