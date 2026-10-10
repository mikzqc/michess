import React, { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

interface ReportModalProps {
  reportedUserName: string;
  reportedUserId: string;
  messageId?: string;
  messageType?: 'direct' | 'game';
  onClose: () => void;
  onSubmit: (report: {
    reportedUserId: string;
    messageId?: string;
    messageType: 'direct' | 'game';
    reason: string;
    details: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

const REPORT_REASONS = [
  'Harassment or abusive language',
  'Hate speech or offensive content',
  'Spam or unwanted advertising',
  'Threats or aggressive behavior',
  'Cheating or unsportsmanlike conduct',
  'Other violation'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  reportedUserName,
  reportedUserId,
  messageId,
  messageType = 'direct',
  onClose,
  onSubmit
}) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const res = await onSubmit({
      reportedUserId,
      messageId,
      messageType,
      reason,
      details: details.trim()
    });

    setSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to submit report. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="p-4 border-b border-border-1 flex items-center justify-between bg-surface-3/50">
          <div className="flex items-center gap-2 text-error">
            <Flag size={20} />
            <h3 className="font-bold text-content-1 text-base">Report Inappropriate Message</h3>
          </div>
          <button
            onClick={onClose}
            className="text-content-3 hover:text-content-1 p-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <p className="text-sm text-content-2">
            You are reporting <span className="font-semibold text-content-1">{reportedUserName}</span>. Reports are reviewed by our moderation team to keep Michess safe and welcoming.
          </p>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-content-3 mb-2">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-surface-1 border border-border-1 rounded-lg px-3 py-2 text-content-1 text-sm focus:outline-none focus:border-accent transition-colors"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r} className="bg-surface-2 text-content-1">
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-content-3 mb-2">
              Additional Details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
              maxLength={500}
              className="w-full bg-surface-1 border border-border-1 rounded-lg p-3 text-content-1 text-sm placeholder:text-content-3 focus:outline-none focus:border-accent transition-colors resize-none"
            />
            <div className="text-right text-xs text-content-3 mt-1">
              {details.length}/500
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-1/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
