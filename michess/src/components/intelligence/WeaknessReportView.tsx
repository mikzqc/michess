import React from 'react';
import { 
  Zap, 
  Compass, 
  Layers, 
  Award, 
  Brain, 
  Play, 
  Lightbulb
} from 'lucide-react';
import type { WeaknessReport, DetectedMistake, WeaknessCategory } from '../../types/intelligence';

interface WeaknessReportViewProps {
  reports: WeaknessReport[];
  onPracticeMistake: (mistake: DetectedMistake) => void;
}

export const WeaknessReportView: React.FC<WeaknessReportViewProps> = ({ reports, onPracticeMistake }) => {
  const getCategoryIcon = (cat: WeaknessCategory) => {
    switch (cat) {
      case 'tactics': return <Zap size={20} className="text-amber-400" />;
      case 'openings': return <Compass size={20} className="text-blue-400" />;
      case 'middlegame': return <Layers size={20} className="text-purple-400" />;
      case 'endgame': return <Award size={20} className="text-emerald-400" />;
      case 'calculation': return <Brain size={20} className="text-accent" />;
    }
  };

  const getSeverityBadge = (sev: WeaknessReport['severity']) => {
    switch (sev) {
      case 'critical':
        return {
          label: 'Critical Weakness',
          bg: 'bg-red-950/60 text-red-300 border-red-800/60',
          dot: 'bg-red-400'
        };
      case 'needs_work':
        return {
          label: 'Needs Attention',
          bg: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          dot: 'bg-amber-400'
        };
      case 'solid':
        return {
          label: 'Solid Foundation',
          bg: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
          dot: 'bg-blue-400'
        };
      case 'strength':
        return {
          label: 'Key Strength',
          bg: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
          dot: 'bg-emerald-400'
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-content-1 mb-1">
          Personalized Weakness Diagnosis
        </h3>
        <p className="text-xs text-content-3">
          Comprehensive breakdown across the 5 core disciplines of chess mastery, backed by your actual game moves and Stockfish evaluations.
        </p>
      </div>

      <div className="space-y-5">
        {reports.map((report) => {
          const badge = getSeverityBadge(report.severity);

          return (
            <div
              key={report.category}
              className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm transition-all hover:border-border-2"
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-1/60 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-surface-3 border border-border-1/60 shrink-0">
                    {getCategoryIcon(report.category)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-content-1">
                      {report.title}
                    </h4>
                    <p className="text-xs text-content-3">
                      Mastery Rating: <span className="font-mono font-bold text-content-1">{report.score}/100</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${badge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                </div>
              </div>

              {/* Diagnosis & Summary */}
              <p className="text-sm text-content-2 mb-5 leading-relaxed">
                {report.summary}
              </p>

              {/* Statistics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {report.stats.map((st, i) => (
                  <div key={i} className="bg-surface-3/70 border border-border-1/50 rounded-xl p-3">
                    <span className="text-[11px] font-mono text-content-3 uppercase block mb-1">
                      {st.label}
                    </span>
                    <span className="text-lg font-bold font-mono text-content-1 block">
                      {st.value}
                    </span>
                    {st.subtext && (
                      <span className="text-[10px] text-content-3 block mt-0.5">
                        {st.subtext}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Real Game Examples */}
              {report.examples.length > 0 && (
                <div className="mb-5 bg-surface-3/40 border border-border-1/40 rounded-xl p-4">
                  <span className="text-xs font-mono font-bold text-content-2 uppercase tracking-wide block mb-3">
                    Examples from Your Games
                  </span>
                  <div className="space-y-2.5">
                    {report.examples.map((ex) => (
                      <div
                        key={ex.id}
                        className="bg-surface-2 border border-border-1 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-accent/40 transition-colors"
                      >
                        <div className="text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-content-1">vs {ex.opponent}</span>
                            <span className="text-[11px] text-content-3">({ex.date})</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-red-950/60 text-red-300 font-bold border border-red-800/40">
                              Move {ex.moveNumber}: {ex.san}
                            </span>
                          </div>
                          <p className="text-content-3 leading-normal text-[11px]">
                            {ex.explanation}
                          </p>
                        </div>

                        <button
                          onClick={() => onPracticeMistake(ex)}
                          className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent text-accent hover:text-white border border-accent/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95"
                        >
                          <Play size={12} />
                          <span>Practice Position</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Recommendations */}
              <div className="pt-3 border-t border-border-1/50">
                <span className="text-xs font-mono font-bold text-accent uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <Lightbulb size={14} />
                  <span>Coach Recommendations</span>
                </span>
                <ul className="space-y-1.5 text-xs text-content-2 list-disc list-inside">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="leading-relaxed">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
