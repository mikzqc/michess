import React, { useState, useEffect } from 'react';
import { 
  Search, Flag, ArrowUpDown, ChevronLeft, ChevronRight, 
  ExternalLink, Shield, Clock, AlertCircle, RefreshCw 
} from 'lucide-react';
import type { AdminReport, ReportStatus } from '../../types/admin';
import { Button } from '../ui/Button';

interface AdminReportsListProps {
  reports: AdminReport[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenReport: (reportId: string) => void;
  onViewProfile: (username: string) => void;
  onFilterChange: (filters: {
    status?: ReportStatus | 'all';
    reason?: string;
    search?: string;
    sortBy?: 'created_at' | 'status' | 'reason';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) => void;
  statusCounts: {
    total: number;
    pending: number;
    underReview: number;
    resolved: number;
    dismissed: number;
  };
}

const COMMON_REASONS = [
  'All Reasons',
  'Harassment or abusive language',
  'Hate speech or offensive content',
  'Spam or unwanted advertising',
  'Threats or aggressive behavior',
  'Cheating or unsportsmanlike conduct',
  'Other violation'
];

export const AdminReportsList: React.FC<AdminReportsListProps> = ({
  reports,
  totalCount,
  loading,
  error,
  onRefresh,
  onOpenReport,
  onViewProfile,
  onFilterChange,
  statusCounts
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('all');
  const [selectedReason, setSelectedReason] = useState<string>('All Reasons');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'status' | 'reason'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Trigger filter change
  useEffect(() => {
    onFilterChange({
      status: selectedStatus,
      reason: selectedReason === 'All Reasons' ? undefined : selectedReason,
      search: searchQuery.trim() || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize
    });
  }, [selectedStatus, selectedReason, searchQuery, sortBy, sortOrder, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const getStatusBadge = (st: ReportStatus) => {
    switch (st) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-accent/30 bg-accent/10 text-accent">
            Under Review
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-500/30 bg-green-500/10 text-green-400">
            Resolved
          </span>
        );
      case 'dismissed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-border-1 bg-surface-3 text-content-3">
            Dismissed
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Filter & Search Bar */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
        {/* Status Tab Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSelectedStatus('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedStatus === 'all'
                ? 'bg-accent text-white border-accent shadow-sm'
                : 'bg-surface-1 text-content-2 border-border-1 hover:bg-surface-3 hover:text-content-1'
            }`}
          >
            <span>All Reports</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {statusCounts.total}
            </span>
          </button>

          <button
            onClick={() => { setSelectedStatus('pending'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedStatus === 'pending'
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-surface-1 text-amber-400 border-amber-500/25 hover:bg-amber-500/10'
            }`}
          >
            <span>Pending</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {statusCounts.pending}
            </span>
          </button>

          <button
            onClick={() => { setSelectedStatus('under_review'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedStatus === 'under_review'
                ? 'bg-accent text-white border-accent shadow-sm'
                : 'bg-surface-1 text-accent border-accent/25 hover:bg-accent/10'
            }`}
          >
            <span>Under Review</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {statusCounts.underReview}
            </span>
          </button>

          <button
            onClick={() => { setSelectedStatus('resolved'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedStatus === 'resolved'
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : 'bg-surface-1 text-green-400 border-green-500/25 hover:bg-green-500/10'
            }`}
          >
            <span>Resolved</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {statusCounts.resolved}
            </span>
          </button>

          <button
            onClick={() => { setSelectedStatus('dismissed'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedStatus === 'dismissed'
                ? 'bg-surface-3 text-content-1 border-border-1'
                : 'bg-surface-1 text-content-3 border-border-1 hover:bg-surface-3'
            }`}
          >
            <span>Dismissed</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {statusCounts.dismissed}
            </span>
          </button>

          <div className="ml-auto">
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-border-1 text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
              title="Refresh Reports"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search & Select Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by username, user ID, or report text..."
              className="w-full bg-surface-1 border border-border-1 rounded-xl pl-9 pr-3 py-2 text-sm text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Reason filter */}
          <div className="relative">
            <select
              value={selectedReason}
              onChange={(e) => { setSelectedReason(e.target.value); setPage(1); }}
              className="w-full bg-surface-1 border border-border-1 rounded-xl px-3 py-2 text-sm text-content-1 focus:outline-none focus:border-accent"
            >
              {COMMON_REASONS.map(r => (
                <option key={r} value={r} className="bg-surface-2 text-content-1">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="flex-1 bg-surface-1 border border-border-1 rounded-xl px-3 py-2 text-sm text-content-1 focus:outline-none focus:border-accent"
            >
              <option value="created_at" className="bg-surface-2">Sort by Date</option>
              <option value="status" className="bg-surface-2">Sort by Status</option>
              <option value="reason" className="bg-surface-2">Sort by Reason</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2 rounded-xl border border-border-1 bg-surface-1 text-content-2 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer flex items-center justify-center"
              title={sortOrder === 'desc' ? 'Newest / Highest First' : 'Oldest / Lowest First'}
            >
              <ArrowUpDown size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-error/15 border border-error/30 text-error text-sm flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={onRefresh} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Reports List Cards / Table */}
      {loading && reports.length === 0 ? (
        <div className="p-12 text-center text-content-2 bg-surface-2 border border-border-1 rounded-2xl">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Loading reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center text-content-3 bg-surface-2 border border-border-1 rounded-2xl flex flex-col items-center gap-3">
          <Shield size={36} className="text-content-3/60" />
          <h4 className="font-bold text-content-1 text-base">No Reports Found</h4>
          <p className="text-xs max-w-sm">
            {selectedStatus !== 'all' || searchQuery || selectedReason !== 'All Reasons'
              ? 'No reports match your current filter settings. Try resetting the filters.'
              : 'There are currently no active reports submitted by users. The community is peaceful!'}
          </p>
          {(selectedStatus !== 'all' || searchQuery || selectedReason !== 'All Reasons') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedStatus('all');
                setSelectedReason('All Reasons');
                setSearchQuery('');
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => {
            const reporterName = report.reporter_profile?.username || 'User ' + report.reporter_id.slice(0, 8);
            const reportedName = report.reported_profile?.username || (report.reported_user_id === 'unknown' ? 'Unknown Opponent' : 'User ' + report.reported_user_id.slice(0, 8));

            return (
              <div
                key={report.id}
                className="bg-surface-2 border border-border-1 hover:border-accent/40 rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col gap-3.5"
              >
                {/* Header row: ID, Status, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-1/60 pb-3">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(report.status)}
                    <span className="text-xs font-mono text-content-3">
                      #{report.id.slice(0, 8)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-1 border border-border-1/50 text-content-3 uppercase">
                      {report.message_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-content-3">
                    <Clock size={13} />
                    <span>{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Parties row: Reporter & Reported User */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-1 p-3 rounded-xl border border-border-1/50">
                  {/* Reporter */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-3 w-16 shrink-0">
                      Reporter:
                    </span>
                    <div className="w-7 h-7 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                      {reporterName[0]?.toUpperCase() || 'U'}
                    </div>
                    <button
                      onClick={() => report.reporter_profile?.username && onViewProfile(report.reporter_profile.username)}
                      className="font-bold text-sm text-content-1 hover:text-accent transition-colors flex items-center gap-1 truncate text-left cursor-pointer"
                    >
                      <span className="truncate">{reporterName}</span>
                      <ExternalLink size={11} className="opacity-60 shrink-0" />
                    </button>
                  </div>

                  {/* Reported User */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-3 w-16 shrink-0">
                      Reported:
                    </span>
                    <div className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center shrink-0">
                      {reportedName[0]?.toUpperCase() || 'U'}
                    </div>
                    <button
                      onClick={() => report.reported_profile?.username && onViewProfile(report.reported_profile.username)}
                      className="font-bold text-sm text-content-1 hover:text-red-400 transition-colors flex items-center gap-1 truncate text-left cursor-pointer"
                    >
                      <span className="truncate">{reportedName}</span>
                      <ExternalLink size={11} className="opacity-60 shrink-0" />
                    </button>
                    {report.reported_profile?.is_banned && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-400 font-bold border border-red-900 shrink-0">
                        Banned
                      </span>
                    )}
                  </div>
                </div>

                {/* Reason & Content snippet */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-error">
                    <Flag size={15} className="shrink-0" />
                    <span>{report.reason}</span>
                  </div>

                  {report.details && (
                    <p className="text-xs text-content-2 line-clamp-2 leading-relaxed bg-surface-1/50 p-2.5 rounded-lg border border-border-1/40">
                      {report.details}
                    </p>
                  )}

                  {report.reported_message_content && (
                    <div className="text-xs text-content-3 font-mono bg-surface-3/50 px-2.5 py-1.5 rounded border border-border-1/50 truncate">
                      💬 Message: "{report.reported_message_content}"
                    </div>
                  )}
                </div>

                {/* Footer action button */}
                <div className="flex items-center justify-between pt-2 border-t border-border-1/50">
                  <div className="text-xs text-content-3">
                    {report.admin_notes && (
                      <span className="text-accent font-medium">
                        ✓ Has Admin Notes
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onOpenReport(report.id)}
                    className="cursor-pointer"
                  >
                    Inspect & Moderate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
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
    </div>
  );
};
