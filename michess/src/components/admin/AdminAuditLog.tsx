import React, { useState } from 'react';
import { History, Shield, RefreshCw } from 'lucide-react';
import type { ModerationAction } from '../../types/admin';

interface AdminAuditLogProps {
  auditLog: ModerationAction[];
  loading: boolean;
  onRefresh: () => void;
}

export const AdminAuditLog: React.FC<AdminAuditLogProps> = ({
  auditLog,
  loading,
  onRefresh
}) => {
  const [filterAction, setFilterAction] = useState<string>('all');

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'warn':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">Warning Issued</span>;
      case 'suspend':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">Account Suspended</span>;
      case 'ban':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 text-red-400 border border-red-900/60">Permanent Ban</span>;
      case 'unban':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">Sanction Lifted</span>;
      case 'warn_reporter':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/25 text-red-300 border border-red-800/40">Reporter Misuse Warning</span>;
      case 'reverse_reporter_warning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/25">Warning Reversed</span>;
      case 'status_change':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-3 text-content-2 border border-border-1">Status Updated</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-3 text-content-2 border border-border-1">{actionType}</span>;
    }
  };

  const filteredLog = filterAction === 'all' 
    ? auditLog 
    : auditLog.filter(a => a.action_type === filterAction);

  return (
    <div className="flex flex-col gap-5">
      {/* Filter and stats bar */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/15 text-accent">
            <History size={18} />
          </div>
          <div>
            <h3 className="font-bold text-content-1 text-sm">Moderation Audit Log</h3>
            <p className="text-xs text-content-3">
              Immutable record of all disciplinary and administrative events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-surface-1 border border-border-1 rounded-xl px-3 py-1.5 text-xs text-content-1 focus:outline-none focus:border-accent"
          >
            <option value="all">All Actions</option>
            <option value="warn">Warnings</option>
            <option value="suspend">Suspensions</option>
            <option value="ban">Bans</option>
            <option value="unban">Unbans</option>
            <option value="warn_reporter">Reporter Warnings</option>
            <option value="status_change">Status Changes</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg border border-border-1 bg-surface-1 hover:bg-surface-3 text-content-3 hover:text-content-1 transition-colors cursor-pointer"
            title="Refresh Audit Log"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl overflow-hidden shadow-sm">
        {loading && auditLog.length === 0 ? (
          <div className="p-12 text-center text-content-2">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Loading audit log...</p>
          </div>
        ) : filteredLog.length === 0 ? (
          <div className="p-12 text-center text-content-3 flex flex-col items-center gap-2">
            <Shield size={36} className="text-content-3/60" />
            <p className="text-sm font-semibold text-content-1">No moderation actions found</p>
            <p className="text-xs">No admin actions have been executed yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-1/40">
            {filteredLog.map(action => (
              <div key={action.id} className="p-4 hover:bg-surface-1/40 transition-colors flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {getActionBadge(action.action_type)}
                    <span className="text-xs font-semibold text-content-1">
                      Target: {action.target_profile?.username || action.target_user_id.slice(0, 10)}
                    </span>
                    {action.duration_hours && (
                      <span className="text-[11px] text-content-3">
                        ({action.duration_hours} hours)
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-content-3">
                    {new Date(action.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 text-xs">
                  <div className="text-content-2">
                    <strong className="text-content-3 font-normal mr-1">Reason:</strong>
                    <span>{action.reason}</span>
                    {action.details && (
                      <p className="text-content-3 mt-1 text-[11px] pl-2 border-l border-border-1">
                        {action.details}
                      </p>
                    )}
                  </div>

                  <div className="text-[11px] text-content-3 shrink-0 text-right">
                    <span>By: <strong className="text-accent">{action.admin_profile?.username || 'Admin'}</strong></span>
                    {action.report_id && (
                      <span className="block font-mono text-[10px] opacity-75">
                        Report #{action.report_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
