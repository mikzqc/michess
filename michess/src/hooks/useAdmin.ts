import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import type { 
  AdminReport, 
  AdminDashboardStats, 
  ModerationAction, 
  AdminNote, 
  AdminUserModerationInfo,
  ReportStatus 
} from '../types/admin';

export interface ReportsFilter {
  status?: ReportStatus | 'all';
  reason?: string;
  search?: string;
  sortBy?: 'created_at' | 'status' | 'reason';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function useAdmin() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [totalReportsCount, setTotalReportsCount] = useState(0);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminDashboardStats>({
    totalReports: 0,
    pendingReports: 0,
    underReviewReports: 0,
    resolvedReports: 0,
    dismissedReports: 0,
    bannedUsersCount: 0,
    suspendedUsersCount: 0
  });

  const [auditLog, setAuditLog] = useState<ModerationAction[]>([]);
  const [loadingAuditLog, setLoadingAuditLog] = useState(false);

  // 1. Verify Admin Status
  const verifyAdmin = useCallback(async () => {
    if (!user || !supabase) {
      setIsAdmin(false);
      setCheckingAdmin(false);
      return false;
    }

    setCheckingAdmin(true);
    try {
      // Must be username mikzqc
      const isMikzqc = profile?.username?.toLowerCase() === 'mikzqc';
      if (!isMikzqc) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return false;
      }

      // Check server-side authorization via check_is_admin RPC
      const { data, error } = await supabase.rpc('check_is_admin');
      if (error) {
        // Fallback: If RPC is not created yet, double check directly against profiles table for this auth ID
        const { data: profData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        const verified = profData?.username?.toLowerCase() === 'mikzqc';
        setIsAdmin(verified);
        return verified;
      }

      const verified = Boolean(data);
      setIsAdmin(verified);
      return verified;
    } catch (err) {
      console.error('Error verifying admin permissions:', err);
      // Extra fallback check on profile
      const verified = profile?.username?.toLowerCase() === 'mikzqc';
      setIsAdmin(verified);
      return verified;
    } finally {
      setCheckingAdmin(false);
    }
  }, [user, profile]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  // 2. Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin || !supabase) return;

    try {
      // Fetch report counts grouped by status
      const { data: reportsData, error: reportsErr } = await supabase
        .from('message_reports')
        .select('id, status');

      if (!reportsErr && reportsData) {
        const total = reportsData.length;
        const pending = reportsData.filter(r => (r.status || 'pending') === 'pending').length;
        const underReview = reportsData.filter(r => r.status === 'under_review').length;
        const resolved = reportsData.filter(r => r.status === 'resolved').length;
        const dismissed = reportsData.filter(r => r.status === 'dismissed').length;

        // Fetch banned & suspended profiles counts
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, is_banned, suspended_until');

        const now = new Date();
        const banned = (profilesData || []).filter(p => p.is_banned).length;
        const suspended = (profilesData || []).filter(p => p.suspended_until && new Date(p.suspended_until) > now).length;

        setStats({
          totalReports: total,
          pendingReports: pending,
          underReviewReports: underReview,
          resolvedReports: resolved,
          dismissedReports: dismissed,
          bannedUsersCount: banned,
          suspendedUsersCount: suspended
        });
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  }, [isAdmin]);

  // 3. Fetch Reports with Filter & Pagination
  const fetchReports = useCallback(async (filters: ReportsFilter = {}) => {
    if (!isAdmin || !supabase) return;

    setLoadingReports(true);
    setReportsError(null);

    const {
      status = 'all',
      reason,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20
    } = filters;

    try {
      let query = supabase
        .from('message_reports')
        .select(`
          *,
          reporter_profile:profiles!message_reports_reporter_id_fkey(*)
        `, { count: 'exact' });

      // Status filter
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Reason filter
      if (reason && reason !== 'all') {
        query = query.eq('reason', reason);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      // Extract reported_user_ids to fetch their profiles
      const reportedUserIds = Array.from(new Set(
        (data || [])
          .map(r => r.reported_user_id)
          .filter(Boolean)
      ));

      let reportedProfilesMap: Record<string, any> = {};
      if (reportedUserIds.length > 0) {
        // Query profiles matching UUID format
        const validUuids = reportedUserIds.filter(id => 
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );

        if (validUuids.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('*')
            .in('id', validUuids);

          if (profs) {
            for (const p of profs) {
              reportedProfilesMap[p.id] = p;
            }
          }
        }
      }

      // Optional: fetch message snippets for direct messages
      const directMessageIds = (data || [])
        .filter(r => r.message_id && r.message_type === 'direct')
        .map(r => r.message_id as string);

      let messagesMap: Record<string, string> = {};
      if (directMessageIds.length > 0) {
        const { data: msgData } = await supabase
          .from('direct_messages')
          .select('id, content')
          .in('id', directMessageIds);

        if (msgData) {
          for (const m of msgData) {
            messagesMap[m.id] = m.content;
          }
        }
      }

      // Enrich report objects
      let enrichedReports: AdminReport[] = (data || []).map(r => ({
        ...r,
        status: (r.status || 'pending') as ReportStatus,
        reported_profile: reportedProfilesMap[r.reported_user_id] || null,
        reported_message_content: r.message_id ? messagesMap[r.message_id] : null
      }));

      // Search filter client-side if username was queried
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        enrichedReports = enrichedReports.filter(r => 
          r.id.toLowerCase().includes(q) ||
          r.reporter_id.toLowerCase().includes(q) ||
          r.reported_user_id.toLowerCase().includes(q) ||
          (r.reporter_profile?.username?.toLowerCase().includes(q)) ||
          (r.reported_profile?.username?.toLowerCase().includes(q)) ||
          r.reason.toLowerCase().includes(q) ||
          (r.details && r.details.toLowerCase().includes(q))
        );
      }

      setReports(enrichedReports);
      setTotalReportsCount(count || enrichedReports.length);
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
      setReportsError(err.message || 'Failed to fetch reports');
    } finally {
      setLoadingReports(false);
    }
  }, [isAdmin]);

  // 4. Fetch Full Report Detail (including related counts and notes)
  const fetchReportDetail = useCallback(async (reportId: string) => {
    if (!isAdmin || !supabase) return null;

    try {
      const { data: rep, error: repErr } = await supabase
        .from('message_reports')
        .select(`
          *,
          reporter_profile:profiles!message_reports_reporter_id_fkey(*)
        `)
        .eq('id', reportId)
        .single();

      if (repErr) throw repErr;

      // Fetch reported profile
      let reportedProfile = null;
      if (rep.reported_user_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', rep.reported_user_id)
          .maybeSingle();
        reportedProfile = prof;
      }

      // Fetch reporter statistics (how many reports filed, previous warnings)
      const { count: reportsFiledCount } = await supabase
        .from('message_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_id', rep.reporter_id);

      // Fetch reports against reported user
      const { count: reportsAgainstCount } = await supabase
        .from('message_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reported_user_id', rep.reported_user_id);

      // Fetch message content if message_id exists
      let messageContent = null;
      if (rep.message_id) {
        if (rep.message_type === 'direct') {
          const { data: m } = await supabase
            .from('direct_messages')
            .select('content')
            .eq('id', rep.message_id)
            .maybeSingle();
          messageContent = m?.content;
        } else if (rep.message_type === 'game') {
          const { data: gm } = await supabase
            .from('game_messages')
            .select('content')
            .eq('id', rep.message_id)
            .maybeSingle();
          messageContent = gm?.content;
        }
      }

      // Fetch admin notes for this report
      const { data: notesData } = await supabase
        .from('admin_notes')
        .select(`
          *,
          admin_profile:profiles!admin_notes_admin_id_fkey(username, avatar_url)
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      // Fetch moderation actions on reported user
      const { data: userActions } = await supabase
        .from('moderation_actions')
        .select('*')
        .eq('target_user_id', rep.reported_user_id)
        .order('created_at', { ascending: false });

      // Fetch reporter warning history
      const { data: reporterActions } = await supabase
        .from('moderation_actions')
        .select('*')
        .eq('target_user_id', rep.reporter_id)
        .eq('action_type', 'warn_reporter')
        .order('created_at', { ascending: false });

      return {
        report: {
          ...rep,
          status: (rep.status || 'pending') as ReportStatus,
          reported_profile: reportedProfile,
          reported_message_content: messageContent
        } as AdminReport,
        reportsFiledCount: reportsFiledCount || 0,
        reportsAgainstCount: reportsAgainstCount || 0,
        notes: (notesData || []) as AdminNote[],
        userActions: (userActions || []) as ModerationAction[],
        reporterActions: (reporterActions || []) as ModerationAction[]
      };
    } catch (err: any) {
      console.error('Error fetching report detail:', err);
      return null;
    }
  }, [isAdmin]);

  // 5. Update Report Status
  const updateReportStatus = async (
    reportId: string, 
    status: ReportStatus, 
    adminNotes?: string, 
    action?: string, 
    reason?: string
  ) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      // Call RPC if available
      const { error: rpcErr } = await supabase.rpc('admin_update_report_status', {
        p_report_id: reportId,
        p_status: status,
        p_notes: adminNotes || null,
        p_action: action || null,
        p_reason: reason || null
      });

      if (rpcErr) {
        // Fallback: direct table update with current admin ID
        const updatePayload: any = {
          status,
          updated_at: new Date().toISOString()
        };
        if (adminNotes !== undefined) updatePayload.admin_notes = adminNotes;
        if (status === 'resolved' || status === 'dismissed') {
          updatePayload.resolved_by = user?.id;
          updatePayload.resolved_at = new Date().toISOString();
        }
        if (action) updatePayload.resolution_action = action;
        if (reason) updatePayload.resolution_reason = reason;

        const { error: directErr } = await supabase
          .from('message_reports')
          .update(updatePayload)
          .eq('id', reportId);

        if (directErr) throw directErr;
      }

      // Record status change in audit log
      try {
        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: reportId,
          action_type: 'status_change',
          reason: reason || `Report status updated to ${status}`,
          details: adminNotes || '',
          report_id: reportId
        });
      } catch {}

      // In-place state update
      setReports(prev => prev.map(r => r.id === reportId ? { 
        ...r, 
        status, 
        admin_notes: adminNotes !== undefined ? adminNotes : r.admin_notes,
        resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : r.resolved_at
      } : r));

      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating report status:', err);
      return { success: false, error: err.message || 'Failed to update report status' };
    }
  };

  // 6. Moderation Action: Warn User
  const warnUser = async (targetUserId: string, reason: string, reportId?: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_warn_user', {
        p_target_user_id: targetUserId,
        p_reason: reason,
        p_report_id: reportId || null
      });

      if (rpcErr) {
        // Direct fallback
        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: targetUserId,
          action_type: 'warn',
          reason,
          report_id: reportId || null
        });

        // Send user notification
        try {
          await supabase.from('notifications').insert({
            user_id: targetUserId,
            sender_id: user?.id,
            type: 'moderation_warning',
            message: `Official Moderation Warning: ${reason}`,
            related_id: reportId
          });
        } catch {}

        // If report linked, resolve it
        if (reportId) {
          await supabase.from('message_reports').update({
            status: 'resolved',
            resolved_by: user?.id,
            resolved_at: new Date().toISOString(),
            resolution_action: 'warn',
            resolution_reason: reason
          }).eq('id', reportId);
        }
      }

      if (reportId) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      }
      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to issue warning:', err);
      return { success: false, error: err.message || 'Failed to issue warning' };
    }
  };

  // 7. Moderation Action: Suspend User
  const suspendUser = async (targetUserId: string, hours: number, reason: string, reportId?: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_suspend_user', {
        p_target_user_id: targetUserId,
        p_hours: hours,
        p_reason: reason,
        p_report_id: reportId || null
      });

      if (rpcErr) {
        const suspendedUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        await supabase.from('profiles').update({
          suspended_until: suspendedUntil,
          suspension_reason: reason
        }).eq('id', targetUserId);

        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: targetUserId,
          action_type: 'suspend',
          reason,
          duration_hours: hours,
          report_id: reportId || null
        });

        try {
          await supabase.from('notifications').insert({
            user_id: targetUserId,
            sender_id: user?.id,
            type: 'moderation_suspension',
            message: `Your account has been temporarily suspended for ${hours} hours. Reason: ${reason}`,
            related_id: reportId
          });
        } catch {}

        if (reportId) {
          await supabase.from('message_reports').update({
            status: 'resolved',
            resolved_by: user?.id,
            resolved_at: new Date().toISOString(),
            resolution_action: 'suspend',
            resolution_reason: reason
          }).eq('id', reportId);
        }
      }

      if (reportId) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      }
      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to suspend user:', err);
      return { success: false, error: err.message || 'Failed to suspend user' };
    }
  };

  // 8. Moderation Action: Ban User
  const banUser = async (targetUserId: string, reason: string, reportId?: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_ban_user', {
        p_target_user_id: targetUserId,
        p_reason: reason,
        p_report_id: reportId || null
      });

      if (rpcErr) {
        await supabase.from('profiles').update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_reason: reason
        }).eq('id', targetUserId);

        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: targetUserId,
          action_type: 'ban',
          reason,
          report_id: reportId || null
        });

        if (reportId) {
          await supabase.from('message_reports').update({
            status: 'resolved',
            resolved_by: user?.id,
            resolved_at: new Date().toISOString(),
            resolution_action: 'ban',
            resolution_reason: reason
          }).eq('id', reportId);
        }
      }

      if (reportId) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      }
      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to ban user:', err);
      return { success: false, error: err.message || 'Failed to ban user' };
    }
  };

  // 9. Moderation Action: Unban User
  const unbanUser = async (targetUserId: string, reason: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_unban_user', {
        p_target_user_id: targetUserId,
        p_reason: reason
      });

      if (rpcErr) {
        await supabase.from('profiles').update({
          is_banned: false,
          banned_at: null,
          banned_reason: null,
          suspended_until: null,
          suspension_reason: null
        }).eq('id', targetUserId);

        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: targetUserId,
          action_type: 'unban',
          reason
        });

        try {
          await supabase.from('notifications').insert({
            user_id: targetUserId,
            sender_id: user?.id,
            type: 'moderation_unban',
            message: `Your account restrictions have been removed: ${reason}`
          });
        } catch {}
      }

      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to unban user:', err);
      return { success: false, error: err.message || 'Failed to unban user' };
    }
  };

  // 10. Moderation Action: Warn Reporter (False / Malicious Reports)
  const warnReporter = async (reportId: string, reporterId: string, reason: string, details?: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_warn_reporter', {
        p_report_id: reportId,
        p_reporter_id: reporterId,
        p_reason: reason,
        p_details: details || null
      });

      if (rpcErr) {
        // Direct fallback
        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: reporterId,
          action_type: 'warn_reporter',
          reason,
          details: details || '',
          report_id: reportId
        });

        // Send official notification to reporter
        try {
          await supabase.from('notifications').insert({
            user_id: reporterId,
            sender_id: user?.id,
            type: 'reporter_warning',
            message: `Official Notice: A warning has been issued regarding your report #${reportId.slice(0, 8)}. Reason: ${reason}. Michess takes false or abusive reports seriously.`,
            related_id: reportId
          });
        } catch {}

        // Mark report as dismissed
        await supabase.from('message_reports').update({
          status: 'dismissed',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
          resolution_action: 'warn_reporter',
          resolution_reason: reason
        }).eq('id', reportId);
      }

      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to warn reporter:', err);
      return { success: false, error: err.message || 'Failed to issue reporter warning' };
    }
  };

  // 11. Moderation Action: Reverse Reporter Warning
  const reverseReporterWarning = async (actionId: string, reason: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_reverse_reporter_warning', {
        p_action_id: actionId,
        p_reason: reason
      });

      if (rpcErr) {
        await supabase.from('moderation_actions').insert({
          admin_id: user?.id,
          target_user_id: actionId,
          action_type: 'reverse_reporter_warning',
          reason
        });
      }

      fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to reverse reporter warning:', err);
      return { success: false, error: err.message || 'Failed to reverse warning' };
    }
  };

  // 12. Add Private Admin Note
  const addAdminNote = async (targetUserId: string, reportId: string, note: string) => {
    if (!isAdmin || !supabase) return { success: false, error: 'Unauthorized' };

    try {
      const { error: rpcErr } = await supabase.rpc('admin_add_note', {
        p_target_user_id: targetUserId,
        p_report_id: reportId,
        p_note: note
      });

      if (rpcErr) {
        const { error: directErr } = await supabase.from('admin_notes').insert({
          admin_id: user?.id,
          target_user_id: targetUserId,
          report_id: reportId,
          note: note.trim()
        });
        if (directErr) throw directErr;
      }

      return { success: true };
    } catch (err: any) {
      console.error('Failed to add admin note:', err);
      return { success: false, error: err.message || 'Failed to add admin note' };
    }
  };

  // 13. Fetch Audit Log
  const fetchAuditLog = useCallback(async (targetUserId?: string, limit = 50) => {
    if (!isAdmin || !supabase) return [];

    setLoadingAuditLog(true);
    try {
      let query = supabase
        .from('moderation_actions')
        .select(`
          *,
          admin_profile:profiles!moderation_actions_admin_id_fkey(username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (targetUserId) {
        query = query.eq('target_user_id', targetUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich target profiles
      const targetIds = Array.from(new Set(
        (data || [])
          .map(a => a.target_user_id)
          .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      ));

      let targetMap: Record<string, any> = {};
      if (targetIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', targetIds);
        if (profs) {
          for (const p of profs) targetMap[p.id] = p;
        }
      }

      const enriched: ModerationAction[] = (data || []).map(a => ({
        ...a,
        target_profile: targetMap[a.target_user_id] || null
      }));

      setAuditLog(enriched);
      return enriched;
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
      return [];
    } finally {
      setLoadingAuditLog(false);
    }
  }, [isAdmin]);

  // 14. Fetch Users List for User Management
  const fetchUsers = useCallback(async (
    searchQuery = '', 
    filterRestrictedOnly = false, 
    page = 1, 
    pageSize = 20
  ) => {
    if (!isAdmin || !supabase) return { users: [], total: 0 };

    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (searchQuery.trim()) {
        query = query.ilike('username', `%${searchQuery.trim()}%`);
      }

      if (filterRestrictedOnly) {
        query = query.or('is_banned.eq.true,suspended_until.gt.now()');
      }

      query = query.order('created_at', { ascending: false });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        users: (data || []) as AdminUserModerationInfo[],
        total: count || (data ? data.length : 0)
      };
    } catch (err) {
      console.error('Failed to fetch users:', err);
      return { users: [], total: 0 };
    }
  }, [isAdmin]);

  // Realtime subscription for automatic updates
  useEffect(() => {
    if (!isAdmin || !supabase) return;

    fetchStats();
    fetchReports();

    const channel = supabase
      .channel(`admin_dashboard_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reports' },
        () => {
          fetchStats();
          fetchReports();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moderation_actions' },
        () => {
          fetchStats();
          fetchAuditLog();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [isAdmin, fetchStats, fetchReports, fetchAuditLog]);

  return {
    isAdmin,
    checkingAdmin,
    stats,
    reports,
    totalReportsCount,
    loadingReports,
    reportsError,
    auditLog,
    loadingAuditLog,
    fetchStats,
    fetchReports,
    fetchReportDetail,
    updateReportStatus,
    warnUser,
    suspendUser,
    banUser,
    unbanUser,
    warnReporter,
    reverseReporterWarning,
    addAdminNote,
    fetchAuditLog,
    fetchUsers,
    verifyAdmin
  };
}
