import React from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Activity, 
  Layers, 
  ShieldAlert, 
  Zap, 
  Compass, 
  BookOpen, 
  Award, 
  ArrowRight
} from 'lucide-react';
import type { IntelligenceSummary } from '../../types/intelligence';

interface IntelligenceDashboardProps {
  summary: IntelligenceSummary;
  onExploreOpening?: (eco: string) => void;
}

export const IntelligenceDashboard: React.FC<IntelligenceDashboardProps> = ({ summary, onExploreOpening }) => {
  const { totalGamesAnalyzed, wins, draws, losses, winRate, overallAcpl, overallAccuracy, phaseBreakdown, topOpenings, trends } = summary;

  // ACPL tier label
  const getAcplTier = (acpl: number) => {
    if (acpl <= 30) return { label: 'Masterful', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' };
    if (acpl <= 45) return { label: 'Strong', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
    if (acpl <= 70) return { label: 'Solid', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };
    return { label: 'Needs Focus', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
  };

  const acplTier = getAcplTier(overallAcpl);

  return (
    <div className="space-y-6">
      {/* 1. Core Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Win / Loss Record */}
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-content-3 uppercase tracking-wider">Record</span>
            <div className="p-2 rounded-xl bg-accent/15 text-accent">
              <Trophy size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl sm:text-3xl font-black text-content-1">{winRate}%</span>
            <span className="text-xs font-semibold text-content-3">Win Rate</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-content-2">
            <span className="text-green-400 font-bold">{wins}W</span>
            <span>•</span>
            <span className="text-content-3 font-bold">{draws}D</span>
            <span>•</span>
            <span className="text-red-400 font-bold">{losses}L</span>
            <span className="text-content-3">({totalGamesAnalyzed} analyzed)</span>
          </div>
        </div>

        {/* Card 2: Average Centipawn Loss */}
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-content-3 uppercase tracking-wider">Engine Error</span>
            <div className="p-2 rounded-xl bg-accent/15 text-accent">
              <Activity size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl sm:text-3xl font-black text-content-1">{overallAcpl}</span>
            <span className="text-xs font-semibold text-content-3">Avg Centipawn Loss</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold font-mono tracking-wide" style={{ color: acplTier.color }}>
            <span>{acplTier.label} Precision</span>
          </div>
        </div>

        {/* Card 3: Overall Move Accuracy */}
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-content-3 uppercase tracking-wider">Accuracy</span>
            <div className="p-2 rounded-xl bg-accent/15 text-accent">
              <Award size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl sm:text-3xl font-black text-content-1">{overallAccuracy}%</span>
            <span className="text-xs font-semibold text-content-3">Move Quality</span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-accent h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, overallAccuracy)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Tactical Blunders Rate */}
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-content-3 uppercase tracking-wider">Blunder Rate</span>
            <div className="p-2 rounded-xl bg-red-950/40 text-red-400 border border-red-800/40">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl sm:text-3xl font-black text-content-1">
              {(phaseBreakdown.opening.blunderRate + phaseBreakdown.middlegame.blunderRate + phaseBreakdown.endgame.blunderRate).toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-content-3">Per Game</span>
          </div>
          <p className="text-[11px] text-content-3">
            Across opening, middlegame & endgame
          </p>
        </div>
      </div>

      {/* 2. Performance by Game Phase (Opening, Middlegame, Endgame) */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-content-1 flex items-center gap-2">
              <Layers size={18} className="text-accent" />
              <span>Phase Performance Breakdown</span>
            </h3>
            <p className="text-xs text-content-3">
              How accurately you play across each critical phase of the game
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Opening Phase Card */}
          <div className="bg-surface-3/70 border border-border-1 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-content-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Compass size={14} className="text-blue-400" />
                  Opening (Moves 1-12)
                </span>
                <span className="text-xs font-bold text-blue-400 font-mono">
                  {phaseBreakdown.opening.accuracy}% Acc
                </span>
              </div>
              <div className="w-full bg-surface-1 rounded-full h-1.5 mb-4 overflow-hidden border border-border-1/50">
                <div 
                  className="bg-blue-400 h-full rounded-full" 
                  style={{ width: `${phaseBreakdown.opening.accuracy}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-border-1/50 text-content-3">
              <div className="flex justify-between">
                <span>Centipawn Loss:</span>
                <span className="text-content-1 font-bold">{phaseBreakdown.opening.acpl} cp</span>
              </div>
              <div className="flex justify-between">
                <span>Blunder Frequency:</span>
                <span className={phaseBreakdown.opening.blunderRate > 0.5 ? 'text-red-400 font-bold' : 'text-content-1 font-bold'}>
                  {phaseBreakdown.opening.blunderRate} / game
                </span>
              </div>
            </div>
          </div>

          {/* Middlegame Phase Card */}
          <div className="bg-surface-3/70 border border-border-1 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-content-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400" />
                  Middlegame
                </span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {phaseBreakdown.middlegame.accuracy}% Acc
                </span>
              </div>
              <div className="w-full bg-surface-1 rounded-full h-1.5 mb-4 overflow-hidden border border-border-1/50">
                <div 
                  className="bg-amber-400 h-full rounded-full" 
                  style={{ width: `${phaseBreakdown.middlegame.accuracy}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-border-1/50 text-content-3">
              <div className="flex justify-between">
                <span>Centipawn Loss:</span>
                <span className="text-content-1 font-bold">{phaseBreakdown.middlegame.acpl} cp</span>
              </div>
              <div className="flex justify-between">
                <span>Blunder Frequency:</span>
                <span className={phaseBreakdown.middlegame.blunderRate > 0.8 ? 'text-red-400 font-bold' : 'text-content-1 font-bold'}>
                  {phaseBreakdown.middlegame.blunderRate} / game
                </span>
              </div>
            </div>
          </div>

          {/* Endgame Phase Card */}
          <div className="bg-surface-3/70 border border-border-1 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-content-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Award size={14} className="text-emerald-400" />
                  Endgame
                </span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {phaseBreakdown.endgame.accuracy > 0 ? `${phaseBreakdown.endgame.accuracy}% Acc` : 'N/A'}
                </span>
              </div>
              <div className="w-full bg-surface-1 rounded-full h-1.5 mb-4 overflow-hidden border border-border-1/50">
                <div 
                  className="bg-emerald-400 h-full rounded-full" 
                  style={{ width: `${phaseBreakdown.endgame.accuracy}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-border-1/50 text-content-3">
              <div className="flex justify-between">
                <span>Centipawn Loss:</span>
                <span className="text-content-1 font-bold">
                  {phaseBreakdown.endgame.accuracy > 0 || phaseBreakdown.endgame.acpl > 0 ? `${phaseBreakdown.endgame.acpl} cp` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Blunder Frequency:</span>
                <span className={phaseBreakdown.endgame.blunderRate > 0.5 ? 'text-red-400 font-bold' : 'text-content-1 font-bold'}>
                  {phaseBreakdown.endgame.blunderRate} / game
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Top Openings & Repertoire Performance */}
      {topOpenings.length > 0 && (
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-content-1 flex items-center gap-2">
                <BookOpen size={18} className="text-accent" />
                <span>Frequently Encountered Openings</span>
              </h3>
              <p className="text-xs text-content-3">
                Your performance and accuracy across recognized opening variations
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-1/70 font-mono uppercase text-[11px] text-content-3">
                  <th className="py-2.5 px-3">Opening</th>
                  <th className="py-2.5 px-3">ECO</th>
                  <th className="py-2.5 px-3 text-center">Played</th>
                  <th className="py-2.5 px-3 text-center">Win Rate</th>
                  <th className="py-2.5 px-3 text-center">Avg ACPL</th>
                  <th className="py-2.5 px-3 text-center">Accuracy</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-1/40">
                {topOpenings.map(op => (
                  <tr key={op.eco + op.name} className="hover:bg-surface-3/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-content-1 max-w-xs truncate">
                      {op.name}
                    </td>
                    <td className="py-3 px-3 font-mono text-accent font-bold">
                      {op.eco}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-content-2">
                      {op.played}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className={`font-bold ${op.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {op.winRate}%
                      </span>
                      <span className="text-[10px] text-content-3 block">
                        ({op.wins}W-{op.draws}D-{op.losses}L)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-content-2">
                      {op.acpl} cp
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-content-1 font-bold">
                      {op.accuracy}%
                    </td>
                    <td className="py-3 px-3 text-right">
                      {onExploreOpening && (
                        <button
                          onClick={() => onExploreOpening(op.eco)}
                          className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-accent hover:text-white text-content-2 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Explore</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Recent Performance Trends */}
      {trends.length >= 2 && (
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-content-1 flex items-center gap-2">
                <TrendingUp size={18} className="text-accent" />
                <span>Recent Performance Trends</span>
              </h3>
              <p className="text-xs text-content-3">
                Tracking your move accuracy and blunder reduction across recent games
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Accuracy Trend List */}
            <div className="bg-surface-3/50 border border-border-1 rounded-xl p-4">
              <span className="text-xs font-mono font-bold text-content-2 uppercase tracking-wide block mb-3">
                Accuracy Progression (Last {trends.length} Games)
              </span>
              <div className="space-y-2">
                {trends.slice(-6).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-mono py-1 border-b border-border-1/30">
                    <span className="text-content-3 truncate max-w-[120px]">
                      vs {t.opponent}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-surface-1 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-accent h-full rounded-full" 
                          style={{ width: `${t.accuracy}%` }} 
                        />
                      </div>
                      <span className="font-bold text-content-1 w-10 text-right">{t.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Centipawn Loss Progression */}
            <div className="bg-surface-3/50 border border-border-1 rounded-xl p-4">
              <span className="text-xs font-mono font-bold text-content-2 uppercase tracking-wide block mb-3">
                Error Rate (ACPL & Blunders)
              </span>
              <div className="space-y-2">
                {trends.slice(-6).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-mono py-1 border-b border-border-1/30">
                    <span className="text-content-3 truncate max-w-[120px]">
                      Game #{t.gameIndex} ({t.date})
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-content-2">{t.acpl} cp loss</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.blunders === 0 ? 'bg-green-950/60 text-green-400 border border-green-800/40' : 'bg-red-950/60 text-red-400 border border-red-800/40'
                      }`}>
                        {t.blunders} blunder{t.blunders === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
