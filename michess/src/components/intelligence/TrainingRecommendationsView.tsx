import React from 'react';
import { 
  Puzzle, 
  BookOpen, 
  Award, 
  RotateCcw, 
  ArrowRight,
  Target,
  CheckCircle2
} from 'lucide-react';
import type { TrainingRecommendation, DetectedMistake } from '../../types/intelligence';

interface TrainingRecommendationsViewProps {
  recommendations: TrainingRecommendation[];
  onLaunchPositionRetry: (mistake: DetectedMistake) => void;
  onLaunchPuzzles: () => void;
  onLaunchOpenings: (eco?: string) => void;
}

export const TrainingRecommendationsView: React.FC<TrainingRecommendationsViewProps> = ({
  recommendations,
  onLaunchPositionRetry,
  onLaunchPuzzles,
  onLaunchOpenings
}) => {
  const getIcon = (type: TrainingRecommendation['type']) => {
    switch (type) {
      case 'position_retry':
        return <RotateCcw size={20} className="text-amber-400" />;
      case 'puzzle':
        return <Puzzle size={20} className="text-teal-400" />;
      case 'opening_explorer':
        return <BookOpen size={20} className="text-blue-400" />;
      case 'endgame_practice':
        return <Award size={20} className="text-emerald-400" />;
    }
  };

  const handleAction = (rec: TrainingRecommendation) => {
    if (rec.type === 'position_retry' && rec.mistake) {
      onLaunchPositionRetry(rec.mistake);
    } else if (rec.type === 'puzzle' || rec.type === 'endgame_practice') {
      onLaunchPuzzles();
    } else if (rec.type === 'opening_explorer') {
      onLaunchOpenings(rec.eco);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-content-1 mb-1 flex items-center gap-2">
          <Target size={18} className="text-accent" />
          <span>Targeted Training Plan</span>
        </h3>
        <p className="text-xs text-content-3">
          Custom drills derived from your actual engine evaluations and critical turning points. Launch any exercise directly to reinforce better habits.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-surface-2 border border-border-1 rounded-2xl p-8 text-center">
          <CheckCircle2 size={36} className="text-green-400 mx-auto mb-2" />
          <h4 className="text-base font-bold text-content-1">No Urgent Training Required</h4>
          <p className="text-xs text-content-3 mt-1 max-w-md mx-auto">
            Your analyzed games show balanced play across all phases. Keep playing and reviewing games to unlock further intelligence insights.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between hover:border-accent/50 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-surface-3 border border-border-1/60 shrink-0">
                    {getIcon(rec.type)}
                  </div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
                    {rec.category}
                  </span>
                </div>

                <h4 className="text-base font-bold text-content-1 mb-1.5">
                  {rec.title}
                </h4>

                <p className="text-xs text-content-2 leading-relaxed mb-5">
                  {rec.description}
                </p>
              </div>

              <div className="pt-4 border-t border-border-1/50 flex items-center justify-between">
                <span className="text-[11px] font-mono text-content-3">
                  Interactive Training
                </span>

                <button
                  onClick={() => handleAction(rec)}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>{rec.actionText}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
