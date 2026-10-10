import type { UserProfile } from '../hooks/useProfile';

export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed';

export type ModerationActionType = 
  | 'warn' 
  | 'suspend' 
  | 'ban' 
  | 'unban' 
  | 'dismiss_report' 
  | 'warn_reporter' 
  | 'reverse_reporter_warning'
  | 'status_change';

export interface AdminReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  message_id?: string | null;
  message_type: 'direct' | 'game' | 'user';
  reason: string;
  details?: string | null;
  status: ReportStatus;
  admin_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_action?: string | null;
  resolution_reason?: string | null;
  game_id?: string | null;
  created_at: string;
  
  // Joined / Populated fields
  reporter_profile?: UserProfile | null;
  reported_profile?: UserProfile | null;
  reported_message_content?: string | null;
}

export interface ModerationAction {
  id: string;
  admin_id: string | null;
  target_user_id: string;
  action_type: ModerationActionType;
  reason: string;
  details?: string | null;
  duration_hours?: number | null;
  report_id?: string | null;
  created_at: string;
  admin_profile?: UserProfile | null;
  target_profile?: UserProfile | null;
}

export interface AdminNote {
  id: string;
  admin_id: string | null;
  target_user_id: string;
  report_id: string;
  note: string;
  created_at: string;
  admin_profile?: UserProfile | null;
}

export interface AdminDashboardStats {
  totalReports: number;
  pendingReports: number;
  underReviewReports: number;
  resolvedReports: number;
  dismissedReports: number;
  bannedUsersCount: number;
  suspendedUsersCount: number;
}

export interface AdminUserModerationInfo {
  id: string;
  username: string;
  avatar_url?: string;
  rating: number;
  is_banned: boolean;
  banned_at?: string | null;
  banned_reason?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  warning_count: number;
  reporter_warning_count: number;
  created_at: string;
  reports_against_count?: number;
  reports_filed_count?: number;
}
