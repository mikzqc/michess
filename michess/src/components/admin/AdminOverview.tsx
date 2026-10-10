import React from 'react';
import { 
  ShieldAlert, Clock, CheckCircle2, Ban, 
  Users, Flag, ArrowRight, ShieldCheck 
} from 'lucide-react';
import type { AdminDashboardStats } from '../../types/admin';

interface AdminOverviewProps {
  stats: AdminDashboardStats;
  onNavigateTab: (tab: 'reports' | 'users' | 'audit') => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  stats,
  onNavigateTab
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Top Welcome Banner */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-accent/15 text-accent border border-accent/25 shrink-0">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-content-1">
              Michess Administration & Moderation Console
            </h2>
            <p className="text-sm text-content-3 mt-1 max-w-xl">
              Real-time report management, user sanctions, fair-play monitoring, and reporter accountability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('reports')}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <span>Review Reports</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Reports */}
        <div 
          onClick={() => onNavigateTab('reports')}
          className="bg-surface-2 border border-amber-500/30 hover:border-amber-500/60 p-5 rounded-2xl shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Pending Reports
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-content-1">
            {stats.pendingReports}
          </div>
          <div className="text-xs text-content-3 mt-2 flex items-center gap-1 group-hover:text-amber-400 transition-colors">
            <span>Needs moderator attention</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Under Review */}
        <div 
          onClick={() => onNavigateTab('reports')}
          className="bg-surface-2 border border-accent/30 hover:border-accent/60 p-5 rounded-2xl shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Under Review
            </span>
            <div className="p-2 rounded-xl bg-accent/10 text-accent">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-content-1">
            {stats.underReviewReports}
          </div>
          <div className="text-xs text-content-3 mt-2 flex items-center gap-1 group-hover:text-accent transition-colors">
            <span>Active investigations</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Resolved Reports */}
        <div 
          onClick={() => onNavigateTab('reports')}
          className="bg-surface-2 border border-green-500/30 hover:border-green-500/60 p-5 rounded-2xl shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-green-400">
              Resolved Reports
            </span>
            <div className="p-2 rounded-xl bg-green-500/10 text-green-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-content-1">
            {stats.resolvedReports}
          </div>
          <div className="text-xs text-content-3 mt-2 flex items-center gap-1 group-hover:text-green-400 transition-colors">
            <span>Closed & sanctioned</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Restricted Accounts (Banned + Suspended) */}
        <div 
          onClick={() => onNavigateTab('users')}
          className="bg-surface-2 border border-red-500/30 hover:border-red-500/60 p-5 rounded-2xl shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400">
              Sanctioned Users
            </span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
              <Ban size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-content-1">
            {stats.bannedUsersCount + stats.suspendedUsersCount}
          </div>
          <div className="text-xs text-content-3 mt-2 flex items-center gap-1 group-hover:text-red-400 transition-colors">
            <span>{stats.bannedUsersCount} banned, {stats.suspendedUsersCount} suspended</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Guidelines & Quick Moderation Policy Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h3 className="font-bold text-content-1 text-sm flex items-center gap-2">
            <Flag size={16} className="text-accent" />
            Fair Play & Reporting Protocol
          </h3>
          <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
            <li>• <strong>Objective Evidence:</strong> Base warnings, suspensions, and bans on chat logs, timestamps, or verified engine usage patterns.</li>
            <li>• <strong>Escalating Discipline:</strong> Recommended ladder: Formal Warning → 24h Suspension → 7d Suspension → Permanent Ban.</li>
            <li>• <strong>Reporter Accountability:</strong> Dismissing a report does not mean punishment. Only warn reporters when there is clear proof of intentional malicious harassment or repeated fabricated complaints.</li>
          </ul>
        </div>

        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <h3 className="font-bold text-content-1 text-sm flex items-center gap-2">
              <Users size={16} className="text-accent" />
              Community Status Overview
            </h3>
            <p className="text-xs text-content-3 mt-1 leading-relaxed">
              Total reports submitted to date: <strong className="text-content-1">{stats.totalReports}</strong>. Dismissed as unfounded: <strong className="text-content-1">{stats.dismissedReports}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border-1/50">
            <button
              onClick={() => onNavigateTab('users')}
              className="px-3 py-1.5 rounded-lg border border-border-1 bg-surface-1 hover:bg-surface-3 text-xs font-semibold text-content-1 transition-colors cursor-pointer"
            >
              Manage Users & Bans
            </button>
            <button
              onClick={() => onNavigateTab('audit')}
              className="px-3 py-1.5 rounded-lg border border-border-1 bg-surface-1 hover:bg-surface-3 text-xs font-semibold text-content-1 transition-colors cursor-pointer"
            >
              View Moderation Audit Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
