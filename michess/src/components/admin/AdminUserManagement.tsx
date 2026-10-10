import React, { useState, useEffect } from 'react';
import { 
  Search, Users, Ban, Clock, ExternalLink, 
  ChevronLeft, ChevronRight, RefreshCw 
} from 'lucide-react';
import type { AdminUserModerationInfo } from '../../types/admin';
import { Button } from '../ui/Button';
import { AdminActionModal, type AdminActionKind } from './AdminActionModal';

interface AdminUserManagementProps {
  fetchUsers: (search?: string, restrictedOnly?: boolean, page?: number, pageSize?: number) => Promise<{
    users: AdminUserModerationInfo[];
    total: number;
  }>;
  onViewProfile: (username: string) => void;
  warnUser: (userId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  suspendUser: (userId: string, hours: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  banUser: (userId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  unbanUser: (userId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  fetchUsers,
  onViewProfile,
  warnUser,
  suspendUser,
  banUser,
  unbanUser
}) => {
  const [users, setUsers] = useState<AdminUserModerationInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRestrictedOnly, setFilterRestrictedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Action modal
  const [targetUser, setTargetUser] = useState<AdminUserModerationInfo | null>(null);
  const [actionKind, setActionKind] = useState<AdminActionKind | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    const res = await fetchUsers(searchQuery, filterRestrictedOnly, page, pageSize);
    setUsers(res.users);
    setTotalCount(res.total);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [searchQuery, filterRestrictedOnly, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleExecuteAction = async (payload: {
    actionKind: AdminActionKind;
    reason: string;
    durationHours?: number;
    details?: string;
  }) => {
    if (!targetUser) return { success: false, error: 'No target selected' };

    let res: { success: boolean; error?: string } = { success: false };
    switch (payload.actionKind) {
      case 'warn_user':
        res = await warnUser(targetUser.id, payload.reason);
        break;
      case 'suspend_user':
        res = await suspendUser(targetUser.id, payload.durationHours || 24, payload.reason);
        break;
      case 'ban_user':
        res = await banUser(targetUser.id, payload.reason);
        break;
      case 'unban_user':
        res = await unbanUser(targetUser.id, payload.reason);
        break;
    }

    if (res.success) {
      loadUsers();
    }
    return res;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Search & Toggle Bar */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search users by username..."
            className="w-full bg-surface-1 border border-border-1 rounded-xl pl-9 pr-3 py-2 text-sm text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => { setFilterRestrictedOnly(prev => !prev); setPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
              filterRestrictedOnly
                ? 'bg-red-950/40 text-red-400 border-red-900/60 shadow-sm'
                : 'bg-surface-1 text-content-2 border-border-1 hover:bg-surface-3'
            }`}
          >
            <Ban size={14} />
            <span>Sanctioned Accounts Only</span>
          </button>

          <button
            onClick={loadUsers}
            className="p-2 rounded-xl border border-border-1 bg-surface-1 hover:bg-surface-3 text-content-3 hover:text-content-1 transition-colors cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Users Table / List */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl overflow-hidden shadow-sm">
        {loading && users.length === 0 ? (
          <div className="p-12 text-center text-content-2">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Loading user accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-content-3 flex flex-col items-center gap-2">
            <Users size={36} className="text-content-3/60" />
            <p className="text-sm font-semibold text-content-1">No users found matching query</p>
            <p className="text-xs">Try searching for a different username or disable the filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-content-2">
              <thead className="bg-surface-3/50 border-b border-border-1 text-[11px] uppercase tracking-wider text-content-3">
                <tr>
                  <th className="p-4 font-bold">Player</th>
                  <th className="p-4 font-bold">Rating</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold">Warnings</th>
                  <th className="p-4 font-bold">Reporter Warnings</th>
                  <th className="p-4 font-bold text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-1/40">
                {users.map(u => {
                  const isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();

                  return (
                    <tr key={u.id} className="hover:bg-surface-1/50 transition-colors">
                      {/* Player info */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-bold text-content-1 shrink-0">
                            {u.username?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <button
                              onClick={() => onViewProfile(u.username)}
                              className="font-bold text-content-1 hover:text-accent transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>{u.username}</span>
                              <ExternalLink size={11} className="opacity-60" />
                            </button>
                            <span className="text-[10px] text-content-3 font-mono block">
                              ID: {u.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="p-4 font-mono font-bold text-content-1">
                        {u.rating || 1200}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {u.is_banned ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 text-red-400 border border-red-900/60 w-fit">
                              <Ban size={10} /> Permanently Banned
                            </span>
                            {u.banned_reason && (
                              <span className="text-[10px] text-red-300/80 truncate max-w-xs">{u.banned_reason}</span>
                            )}
                          </div>
                        ) : isSuspended ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-900/60 w-fit">
                              <Clock size={10} /> Suspended
                            </span>
                            <span className="text-[10px] text-amber-300/80">
                              Until {new Date(u.suspended_until!).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-green-400 font-medium text-xs">
                            Active / Normal
                          </span>
                        )}
                      </td>

                      {/* Warnings count */}
                      <td className="p-4">
                        {u.warning_count > 0 ? (
                          <span className="font-bold text-amber-400">
                            ⚠️ {u.warning_count}
                          </span>
                        ) : (
                          <span className="text-content-3">0</span>
                        )}
                      </td>

                      {/* Reporter abuse warnings */}
                      <td className="p-4">
                        {u.reporter_warning_count > 0 ? (
                          <span className="font-bold text-red-400">
                            🚨 {u.reporter_warning_count}
                          </span>
                        ) : (
                          <span className="text-content-3">0</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setTargetUser(u); setActionKind('warn_user'); }}
                          >
                            Warn
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => { setTargetUser(u); setActionKind('suspend_user'); }}
                          >
                            Suspend
                          </Button>

                          {u.is_banned || isSuspended ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => { setTargetUser(u); setActionKind('unban_user'); }}
                            >
                              Unban
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setTargetUser(u); setActionKind('ban_user'); }}
                            >
                              Ban
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-surface-2 border border-border-1 rounded-2xl">
          <div className="text-xs text-content-3">
            Showing Page <strong className="text-content-1">{page}</strong> of <strong className="text-content-1">{totalPages}</strong> ({totalCount} total)
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Action modal */}
      {actionKind && targetUser && (
        <AdminActionModal
          isOpen={true}
          actionKind={actionKind}
          targetUsername={targetUser.username}
          targetUserId={targetUser.id}
          onClose={() => { setActionKind(null); setTargetUser(null); }}
          onSubmit={handleExecuteAction}
        />
      )}
    </div>
  );
};
