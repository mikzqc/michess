import React, { useState, useEffect } from 'react';
import { 
  Shield, Flag, Users, History, LayoutDashboard, 
  ArrowLeft, Lock 
} from 'lucide-react';
import { useAdmin, type ReportsFilter } from '../../hooks/useAdmin';
import { AdminOverview } from './AdminOverview';
import { AdminReportsList } from './AdminReportsList';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminAuditLog } from './AdminAuditLog';
import { AdminReportDetailModal } from './AdminReportDetailModal';
import { Button } from '../ui/Button';

interface AdminAreaProps {
  onBack: () => void;
  onViewProfile: (username: string) => void;
}

export const AdminArea: React.FC<AdminAreaProps> = ({
  onBack,
  onViewProfile
}) => {
  const {
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
    fetchUsers
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users' | 'audit'>('reports');
  const [inspectingReportId, setInspectingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      if (activeTab === 'reports') fetchReports();
      if (activeTab === 'audit') fetchAuditLog();
    }
  }, [isAdmin, activeTab]);

  // If verifying admin
  if (checkingAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="font-bold text-content-1 text-base">Verifying Admin Authorization</h3>
          <p className="text-xs text-content-3 mt-1">Validating server-side credentials and security role...</p>
        </div>
      </div>
    );
  }

  // Access Denied if not authorized as mikzqc
  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-surface-2 border border-red-900/40 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-red-950/50 text-red-400 border border-red-900/50">
            <Lock size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-content-1">Access Denied</h2>
            <p className="text-sm text-content-2">
              Administrator privileges required. Only verified administrator accounts can access the moderation panel.
            </p>
          </div>
          <p className="text-xs text-content-3 font-mono bg-surface-1 p-2 rounded-lg border border-border-1/50 w-full">
            Error: 403 Forbidden • Security Policy Enforced
          </p>
          <Button onClick={onBack} variant="outline" className="w-full mt-2">
            Return to Michess Home
          </Button>
        </div>
      </div>
    );
  }

  const handleFilterChange = (filters: ReportsFilter) => {
    fetchReports(filters);
  };

  return (
    <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-2 border border-border-1 text-content-2 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
            title="Back to Home"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-content-1 tracking-tight">
                Admin Panel
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent/15 text-accent border border-accent/30 flex items-center gap-1">
                <Shield size={12} />
                <span>mikzqc</span>
              </span>
            </div>
            <p className="text-xs text-content-3 mt-0.5">
              Report management, user investigations, and community safety console.
            </p>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-2 border border-border-1 rounded-xl shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
            }`}
          >
            <Flag size={14} />
            <span>Reports</span>
            {stats.pendingReports > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'reports' ? 'bg-black/25 text-white' : 'bg-amber-500 text-black'
              }`}>
                {stats.pendingReports}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
            }`}
          >
            <Users size={14} />
            <span>User Management</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
            }`}
          >
            <History size={14} />
            <span>Audit Log</span>
          </button>
        </div>
      </div>

      {/* Main Tab Panels */}
      {activeTab === 'reports' && (
        <AdminReportsList
          reports={reports}
          totalCount={totalReportsCount}
          loading={loadingReports}
          error={reportsError}
          onRefresh={() => fetchReports()}
          onOpenReport={(id) => setInspectingReportId(id)}
          onViewProfile={onViewProfile}
          onFilterChange={handleFilterChange}
          statusCounts={{
            total: stats.totalReports,
            pending: stats.pendingReports,
            underReview: stats.underReviewReports,
            resolved: stats.resolvedReports,
            dismissed: stats.dismissedReports
          }}
        />
      )}

      {activeTab === 'overview' && (
        <AdminOverview
          stats={stats}
          onNavigateTab={(t) => setActiveTab(t)}
        />
      )}

      {activeTab === 'users' && (
        <AdminUserManagement
          fetchUsers={fetchUsers}
          onViewProfile={onViewProfile}
          warnUser={warnUser}
          suspendUser={suspendUser}
          banUser={banUser}
          unbanUser={unbanUser}
        />
      )}

      {activeTab === 'audit' && (
        <AdminAuditLog
          auditLog={auditLog}
          loading={loadingAuditLog}
          onRefresh={() => fetchAuditLog()}
        />
      )}

      {/* Detailed Report Inspection Modal */}
      {inspectingReportId && (
        <AdminReportDetailModal
          reportId={inspectingReportId}
          onClose={() => setInspectingReportId(null)}
          onViewProfile={onViewProfile}
          fetchReportDetail={fetchReportDetail}
          updateReportStatus={updateReportStatus}
          warnUser={warnUser}
          suspendUser={suspendUser}
          banUser={banUser}
          unbanUser={unbanUser}
          warnReporter={warnReporter}
          reverseReporterWarning={reverseReporterWarning}
          addAdminNote={addAdminNote}
          onReportUpdated={() => {
            fetchStats();
            fetchReports();
          }}
        />
      )}
    </div>
  );
};
