import React, { useMemo } from 'react';
import type { AnalyzedMove } from '../types/review';
import { MoveClassificationBadge } from './MoveClassificationBadge';
import { CLASSIFICATIONS, type MoveClassificationType } from '../types/classification';

interface EvaluationGraphProps {
  analyzedMoves: AnalyzedMove[];
  currentMoveIndex: number;
  onMoveSelect: (index: number) => void;
}

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({ analyzedMoves, currentMoveIndex, onMoveSelect }) => {
  const height = 120;
  const padding = 10;
  const innerHeight = height - padding * 2;
  const centerY = height / 2;

  // We add an initial "0" point for the starting position
  const points = useMemo(() => {
    const getWhiteCp = (move: AnalyzedMove) => {
      const score = move.evalAfter.score;
      if (!score) return 0;
      if (score.type === 'mate') {
        return Math.sign(score.value) * (10000 - Math.abs(score.value) * 100);
      }
      return score.value;
    };

    const getWinProb = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));

    const result: { index: number; cp: number; wp: number; y: number; move: AnalyzedMove | null }[] = [{
      index: -1,
      cp: 0,
      wp: 0.5,
      y: centerY,
      move: null
    }];

    analyzedMoves.forEach((move, i) => {
      const cp = getWhiteCp(move);
      const wp = getWinProb(cp);
      // map wp (0 to 1) to y (innerHeight to padding)
      // wp = 1 -> y = padding (White winning, top)
      // wp = 0 -> y = innerHeight + padding (Black winning, bottom)
      const y = padding + (1 - wp) * innerHeight;
      result.push({
        index: i,
        cp,
        wp,
        y,
        move
      });
    });

    return result;
  }, [analyzedMoves, innerHeight, padding, centerY]);

  if (analyzedMoves.length === 0) return null;

  // We need to build SVG paths
  // The graph should fill the width. We use SVG viewBox to make it responsive.
  const width = Math.max(500, points.length * 10);
  const viewBox = `0 0 ${width} ${height}`;

  const xStep = width / Math.max(1, points.length - 1);
  
  const pathD = points.map((p, i) => {
    const x = i * xStep;
    return `${i === 0 ? 'M' : 'L'} ${x} ${p.y}`;
  }).join(' ');

  // Fill area for White (above center) and Black (below center)
  const whiteAreaD = `${pathD} L ${(points.length - 1) * xStep} ${centerY} L 0 ${centerY} Z`;
  const blackAreaD = `${pathD} L ${(points.length - 1) * xStep} ${centerY} L 0 ${centerY} Z`;

  // Get active point
  const activeX = (currentMoveIndex + 1) * xStep;
  
  // Format tooltip text
  const activePoint = points[currentMoveIndex + 1];
  const formatEval = (move: AnalyzedMove | null) => {
    if (!move) return "0.00";
    const score = move.evalAfter.score;
    if (!score) return "0.00";
    if (score.type === 'mate') return `M${Math.abs(score.value)}`;
    const cp = score.value / 100;
    return cp > 0 ? `+${cp.toFixed(2)}` : cp.toFixed(2);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-col gap-2 relative group overflow-x-auto overflow-y-hidden hide-scrollbar">
      <div className="flex justify-between items-center text-xs text-slate-400 font-bold px-1">
        <span>Game Evaluation</span>
      </div>
      
      <div className="relative w-full overflow-x-auto hide-scrollbar">
        <div style={{ width: `${width}px`, height: `${height}px` }} className="relative">
          <svg viewBox={viewBox} className="w-full h-full">
            {/* Center line */}
            <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
            
            {/* Areas */}
            <clipPath id="whiteClip">
              <rect x="0" y="0" width={width} height={centerY} />
            </clipPath>
            <clipPath id="blackClip">
              <rect x="0" y={centerY} width={width} height={centerY} />
            </clipPath>

            <path d={whiteAreaD} fill="rgba(255, 255, 255, 0.15)" clipPath="url(#whiteClip)" />
            <path d={blackAreaD} fill="rgba(0, 0, 0, 0.4)" clipPath="url(#blackClip)" />
            
            {/* Main line */}
            <path d={pathD} fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />

            {/* Active indicator line */}
            <line x1={activeX} y1={0} x2={activeX} y2={height} stroke="#38bdf8" strokeWidth="2" opacity="0.5" />
            <circle cx={activeX} cy={activePoint?.y || centerY} r="4" fill="#38bdf8" />

            {/* Click areas */}
            {points.map((p, i) => {
              const x = i * xStep;
              return (
                <rect
                  key={p.index}
                  x={Math.max(0, x - xStep / 2)}
                  y="0"
                  width={xStep}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => onMoveSelect(p.index)}
                />
              );
            })}

            {/* Classification Markers */}
            {points.map((p, i) => {
              if (!p.move || !p.move.classification) return null;
              
              const interesting = ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'blunder', 'miss'];
              if (!interesting.includes(p.move.classification)) return null;
              
              const x = i * xStep;
              let color = '#94a3b8';
              if (p.move.classification === 'brilliant') color = '#2dd4bf';
              if (p.move.classification === 'great') color = '#818cf8';
              if (p.move.classification === 'best') color = '#4ade80';
              if (p.move.classification === 'inaccuracy') color = '#facc15';
              if (p.move.classification === 'mistake') color = '#fb923c';
              if (p.move.classification === 'miss') color = '#f43f5e';
              if (p.move.classification === 'blunder') color = '#ef4444';

              return (
                <circle key={`marker-${p.index}`} cx={x} cy={p.y} r="3" fill={color} stroke="#1e293b" strokeWidth="1" className="pointer-events-none" />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Custom Tooltip */}
      <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded shadow-xl z-10 flex flex-col gap-1">
        {activePoint && activePoint.move ? (
          <>
            <div className="font-bold flex items-center gap-1">
              Move {activePoint.move.moveNumber}{activePoint.move.color === 'b' ? '...' : '.'} {activePoint.move.san}
              {activePoint.move.classification && (
                <MoveClassificationBadge classification={activePoint.move.classification} />
              )}
            </div>
            <div className="text-slate-300">Eval: <span className="font-mono">{formatEval(activePoint.move)}</span></div>
            {activePoint.move.accuracy !== undefined && (
              <div className="text-slate-300">Accuracy: <span className="font-mono">{activePoint.move.accuracy.toFixed(1)}%</span></div>
            )}
              {activePoint.move.classification && (
                <div className="text-slate-300">Class: <span className="font-bold">{CLASSIFICATIONS[activePoint.move.classification as any as MoveClassificationType]?.name || activePoint.move.classification}</span></div>
              )}
          </>
        ) : (
          <div className="font-bold">Starting Position</div>
        )}
      </div>
    </div>
  );
};
