import React, { useState, useEffect } from 'react';
import { 
  X, Shield, Flag, ExternalLink, MessageSquare, History, Send 
} from 'lucide-react';
import type { AdminReport, ReportStatus, AdminNote, ModerationAction } from '../../types/admin';
import { Button } from '../ui/Button';
import { AdminActionModal, type AdminActionKind } from './AdminActionModal';

interface AdminReportDetailModalProps {
  reportId: string;
  onClose: () => void;
  onViewProfile: (username: string) => void;
  fetchReportDetail: (reportId: string) => Promise<{
    report: AdminReport;
    reportsFiledCount: number;
    reportsAgainstCount: number;
    notes: AdminNote[];
    userActions: ModerationAction[];
    reporterActions: ModerationAction[];
  } | null>;
  updateReportStatus: (reportId: string, status: ReportStatus, notes?: string, action?: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  warnUser: (userId: string, reason: string, reportId?: string) => Promise<{ success: boolean; error?: string }>;
  suspendUser: (userId: string, hours: number, reason: string, reportId?: string) => Promise<{ success: boolean; error?: string }>;
  banUser: (userId: string, reason: string, reportId?: string) => Promise<{ success: boolean; error?: string }>;
  unbanUser: (userId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  warnReporter: (reportId: string, reporterId: string, reason: string, details?: string) => Promise<{ success: boolean; error?: string }>;
  reverseReporterWarning: (actionId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  addAdminNote: (targetUserId: string, reportId: string, note: string) => Promise<{ success: boolean; error?: string }>;
  onReportUpdated?: () => void;
}

export const AdminReportDetailModal: React.FC<AdminReportDetailModalProps> = ({
  reportId,
  onClose,
  onViewProfile,
  fetchReportDetail,
  updateReportStatus,
  warnUser,
  suspendUser,
  banUser,
  unbanUser,
  warnReporter,
  reverseReporterWarning,
  addAdminNote,
  onReportUpdated
}) => {
  const [data, setData] = useState<{
    report: AdminReport;
    reportsFiledCount: number;
    reportsAgainstCount: number;
    notes: AdminNote[];
    userActions: ModerationAction[];
    reporterActions: ModerationAction[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'notes'>('details');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Action modal state
  const [actionModalKind, setActionModalKind] = useState<AdminActionKind | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await fetchReportDetail(reportId);
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [reportId]);

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-xl p-8 text-center text-content-2">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading report details...</p>
        </div>
      </div>
    );
  }

  const { report, reportsFiledCount, reportsAgainstCount, notes, userActions, reporterActions } = data;
  const reporterName = report.reporter_profile?.username || 'User ' + report.reporter_id.slice(0, 8);
  const reportedName = report.reported_profile?.username || (report.reported_user_id === 'unknown' ? 'Unknown Opponent' : 'User ' + report.reported_user_id.slice(0, 8));

  const handleStatusChange = async (newStatus: ReportStatus) => {
    setUpdatingStatus(true);
    const res = await updateReportStatus(report.id, newStatus);
    setUpdatingStatus(false);
    if (res.success) {
      setData(prev => prev ? {
        ...prev,
        report: { ...prev.report, status: newStatus }
      } : null);
      onReportUpdated?.();
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setAddingNote(true);
    const res = await addAdminNote(report.reported_user_id, report.id, newNote);
    setAddingNote(false);
    if (res.success) {
      setNewNote('');
      loadData();
    }
  };

  const handleExecuteAction = async (payload: {
    actionKind: AdminActionKind;
    reason: string;
    durationHours?: number;
    details?: string;
  }) => {
    let res: { success: boolean; error?: string } = { success: false };

    switch (payload.actionKind) {
      case 'warn_user':
        res = await warnUser(report.reported_user_id, payload.reason, report.id);
        break;
      case 'suspend_user':
        res = await suspendUser(report.reported_user_id, payload.durationHours || 24, payload.reason, report.id);
        break;
      case 'ban_user':
        res = await banUser(report.reported_user_id, payload.reason, report.id);
        break;
      case 'unban_user':
        res = await unbanUser(report.reported_user_id, payload.reason);
        break;
      case 'dismiss_report':
        res = await updateReportStatus(report.id, 'dismissed', payload.details, 'dismiss', payload.reason);
        break;
      case 'warn_reporter':
        res = await warnReporter(report.id, report.reporter_id, payload.reason, payload.details);
        break;
    }

    if (res.success) {
      loadData();
      onReportUpdated?.();
    }
    return res;
  };

  const getStatusBadge = (st: ReportStatus) => {
    switch (st) {
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400">Pending Review</span>;
      case 'under_review':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-accent/30 bg-accent/10 text-accent">Under Review</span>;
      case 'resolved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-500/30 bg-green-500/10 text-green-400">Resolved</span>;
      case 'dismissed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-border-1 bg-surface-3 text-content-3">Dismissed</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-fade-in overflow-y-auto">
        <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in my-auto">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border-1 flex items-center justify-between bg-surface-3/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/25">
                <Shield size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-content-1 text-base">Report Investigation</h3>
                  {getStatusBadge(report.status)}
                </div>
                <p className="text-xs text-content-3 font-mono mt-0.5">
                  ID: {report.id} • Submitted {new Date(report.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-content-3 hover:text-content-1 p-1.5 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-border-1 bg-surface-2 px-5 gap-6 text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'details' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-content-1'
              }`}
            >
              Report Details & Context
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === 'history' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-content-1'
              }`}
            >
              <History size={14} />
              <span>Prior History ({userActions.length + reporterActions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === 'notes' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-content-1'
              }`}
            >
              <span>Admin Notes ({notes.length})</span>
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {activeTab === 'details' && (
              <>
                {/* Users Comparison Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reporter Box */}
                  <div className="p-4 rounded-xl border border-border-1 bg-surface-1 flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-content-3 block mb-1">
                        Reporter
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent">
                          {reporterName[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <button
                            onClick={() => report.reporter_profile?.username && onViewProfile(report.reporter_profile.username)}
                            className="font-bold text-content-1 text-sm hover:text-accent transition-colors flex items-center gap-1.5 text-left cursor-pointer"
                          >
                            <span>{reporterName}</span>
                            <ExternalLink size={12} className="opacity-70" />
                          </button>
                          <span className="text-[11px] text-content-3 font-mono block">
                            ID: {report.reporter_id.slice(0, 14)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border-1/50 flex items-center justify-between text-xs text-content-3">
                      <span>Total Reports Filed: <strong className="text-content-1">{reportsFiledCount}</strong></span>
                      {data.report.reporter_profile?.reporter_warning_count ? (
                        <span className="text-red-400 font-semibold">
                          ⚠️ {data.report.reporter_profile.reporter_warning_count} Abuse Warnings
                        </span>
                      ) : (
                        <span className="text-green-400">Clean Reporter Record</span>
                      )}
                    </div>
                  </div>

                  {/* Reported User Box */}
                  <div className="p-4 rounded-xl border border-border-1 bg-surface-1 flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-content-3 block mb-1">
                        Reported User
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center font-bold text-red-400">
                          {reportedName[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <button
                            onClick={() => report.reported_profile?.username && onViewProfile(report.reported_profile.username)}
                            className="font-bold text-content-1 text-sm hover:text-red-400 transition-colors flex items-center gap-1.5 text-left cursor-pointer"
                          >
                            <span>{reportedName}</span>
                            <ExternalLink size={12} className="opacity-70" />
                          </button>
                          <span className="text-[11px] text-content-3 font-mono block">
                            ID: {report.reported_user_id.slice(0, 14)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border-1/50 flex items-center justify-between text-xs text-content-3">
                      <span>Reports Against: <strong className="text-content-1">{reportsAgainstCount}</strong></span>
                      {report.reported_profile?.is_banned ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950/60 text-red-400 font-bold border border-red-900/60">
                          Banned
                        </span>
                      ) : report.reported_profile?.suspended_until && new Date(report.reported_profile.suspended_until) > new Date() ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-400 font-bold border border-amber-900/60">
                          Suspended
                        </span>
                      ) : (
                        <span className="text-content-2">Status: Normal</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reason & Category */}
                <div className="p-4 rounded-xl border border-border-1 bg-surface-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-3">
                      Report Category & Message Type
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-3 border border-border-1 font-mono text-content-2 uppercase">
                      Type: {report.message_type}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-error flex items-center gap-2">
                    <Flag size={16} />
                    <span>{report.reason}</span>
                  </h4>
                </div>

                {/* Full User-Submitted Description */}
                <div className="p-4 rounded-xl border border-border-1 bg-surface-1 flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-content-3">
                    Reporter Description & Explanation
                  </span>
                  {report.details ? (
                    <p className="text-sm text-content-1 leading-relaxed whitespace-pre-wrap break-words bg-surface-2 p-3 rounded-lg border border-border-1/50">
                      {report.details}
                    </p>
                  ) : (
                    <p className="text-xs text-content-3 italic">
                      No additional written details were provided by the reporter.
                    </p>
                  )}
                </div>

                {/* Attached Message Content / Match info */}
                {(report.reported_message_content || report.game_id || report.message_id) && (
                  <div className="p-4 rounded-xl border border-accent/25 bg-accent/5 flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <MessageSquare size={13} />
                      Attached Message / Match Context
                    </span>
                    {report.reported_message_content && (
                      <div className="bg-surface-2 p-3 rounded-lg border border-border-1">
                        <span className="text-[11px] text-content-3 block mb-1">Message Content at Issue:</span>
                        <p className="text-sm text-content-1 font-mono bg-surface-1 p-2.5 rounded border border-border-1/50 break-words">
                          "{report.reported_message_content}"
                        </p>
                      </div>
                    )}
                    {report.game_id && (
                      <div className="text-xs text-content-2 flex items-center gap-2">
                        <span>Related Match ID:</span>
                        <code className="text-accent bg-surface-2 px-1.5 py-0.5 rounded border border-border-1">
                          {report.game_id}
                        </code>
                      </div>
                    )}
                    {report.message_id && (
                      <div className="text-xs text-content-3 font-mono">
                        Message UUID: {report.message_id}
                      </div>
                    )}
                  </div>
                )}

                {/* Resolution Summary if already resolved or dismissed */}
                {report.status !== 'pending' && report.status !== 'under_review' && (
                  <div className="p-4 rounded-xl border border-border-1 bg-surface-3/30 flex flex-col gap-1.5 text-xs text-content-2">
                    <span className="font-bold text-content-1">Report Concluded:</span>
                    <div>
                      Resolution Action: <strong className="text-content-1 uppercase">{report.resolution_action || 'None'}</strong>
                    </div>
                    {report.resolution_reason && (
                      <div>
                        Reason: <span className="text-content-1">{report.resolution_reason}</span>
                      </div>
                    )}
                    {report.resolved_at && (
                      <div className="text-content-3">
                        Resolved on {new Date(report.resolved_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && (
              <div className="flex flex-col gap-4">
                {/* Reported User's History */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-content-2 mb-2">
                    Prior Actions against {reportedName} ({userActions.length})
                  </h4>
                  {userActions.length === 0 ? (
                    <div className="p-3 rounded-xl border border-border-1 bg-surface-1 text-xs text-content-3 text-center">
                      No previous moderation penalties recorded for this account.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userActions.map(act => (
                        <div key={act.id} className="p-3 rounded-xl border border-border-1 bg-surface-1 flex items-start justify-between text-xs">
                          <div>
                            <span className="font-bold text-content-1 uppercase tracking-wide mr-2 text-[11px] px-1.5 py-0.5 rounded bg-surface-2 border border-border-1">
                              {act.action_type}
                            </span>
                            <span className="text-content-2">{act.reason}</span>
                            {act.duration_hours && (
                              <span className="text-content-3 block mt-0.5">Duration: {act.duration_hours}h</span>
                            )}
                          </div>
                          <span className="text-[11px] text-content-3 shrink-0 ml-2">
                            {new Date(act.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reporter's Abuse History */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                      Reporter Misuse Warnings for {reporterName} ({reporterActions.length})
                    </h4>
                  </div>
                  {reporterActions.length === 0 ? (
                    <div className="p-3 rounded-xl border border-border-1 bg-surface-1 text-xs text-content-3 text-center">
                      No false report warnings on record for this reporter.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reporterActions.map(act => (
                        <div key={act.id} className="p-3 rounded-xl border border-red-900/30 bg-red-950/20 flex items-start justify-between text-xs">
                          <div>
                            <span className="font-bold text-red-400 mr-2 text-[11px]">
                              ⚠️ {act.reason}
                            </span>
                            {act.details && (
                              <p className="text-content-3 mt-1 text-[11px]">{act.details}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            <span className="text-[11px] text-content-3">
                              {new Date(act.created_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={async () => {
                                const revReason = prompt('Reason for reversing this reporter warning:');
                                if (revReason) {
                                  const r = await reverseReporterWarning(act.id, revReason);
                                  if (r.success) loadData();
                                }
                              }}
                              className="text-[10px] text-accent hover:underline cursor-pointer"
                            >
                              Reverse Warning
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add an internal note visible only to admins..."
                    className="flex-1 bg-surface-1 border border-border-1 rounded-xl px-3 py-2 text-sm text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent"
                  />
                  <Button type="submit" disabled={addingNote || !newNote.trim()}>
                    <Send size={14} className="mr-1" />
                    {addingNote ? 'Saving...' : 'Add Note'}
                  </Button>
                </form>

                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <div className="p-6 rounded-xl border border-border-1 bg-surface-1 text-center text-xs text-content-3">
                      No admin notes recorded for this report yet.
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="p-3 rounded-xl border border-border-1 bg-surface-1 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-content-3">
                          <span className="font-bold text-accent">
                            {note.admin_profile?.username || 'Admin'}
                          </span>
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-content-1 whitespace-pre-wrap">{note.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Footer */}
          <div className="p-4 border-t border-border-1 bg-surface-3/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Quick Status Toggles */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-content-3 font-semibold mr-1">Status:</span>
              <button
                disabled={updatingStatus || report.status === 'pending'}
                onClick={() => handleStatusChange('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  report.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-surface-2 text-content-3 border-border-1 hover:text-content-1'
                }`}
              >
                Pending
              </button>
              <button
                disabled={updatingStatus || report.status === 'under_review'}
                onClick={() => handleStatusChange('under_review')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  report.status === 'under_review' ? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-2 text-content-3 border-border-1 hover:text-content-1'
                }`}
              >
                Under Review
              </button>
              <button
                disabled={updatingStatus || report.status === 'resolved'}
                onClick={() => handleStatusChange('resolved')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  report.status === 'resolved' ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-surface-2 text-content-3 border-border-1 hover:text-content-1'
                }`}
              >
                Resolved
              </button>
              <button
                disabled={updatingStatus || report.status === 'dismissed'}
                onClick={() => handleStatusChange('dismissed')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  report.status === 'dismissed' ? 'bg-surface-1 text-content-1 border-border-1' : 'bg-surface-2 text-content-3 border-border-1 hover:text-content-1'
                }`}
              >
                Dismissed
              </button>
            </div>

            {/* Moderation Actions Group */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActionModalKind('dismiss_report')}
              >
                Dismiss
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="text-red-400 border-red-900/40 hover:bg-red-950/20"
                onClick={() => setActionModalKind('warn_reporter')}
                title="Warn reporter if report was intentionally false or malicious"
              >
                Warn Reporter
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActionModalKind('warn_user')}
              >
                Warn User
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActionModalKind('suspend_user')}
              >
                Suspend
              </Button>

              {report.reported_profile?.is_banned ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setActionModalKind('unban_user')}
                >
                  Unban
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setActionModalKind('ban_user')}
                >
                  Ban
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Render Action Confirmation / Inputs Modal */}
      {actionModalKind && (
        <AdminActionModal
          isOpen={true}
          actionKind={actionModalKind}
          targetUsername={actionModalKind === 'warn_reporter' ? reporterName : reportedName}
          targetUserId={actionModalKind === 'warn_reporter' ? report.reporter_id : report.reported_user_id}
          reportId={report.id}
          onClose={() => setActionModalKind(null)}
          onSubmit={handleExecuteAction}
        />
      )}
    </>
  );
};
