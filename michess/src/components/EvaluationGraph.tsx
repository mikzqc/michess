import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { AnalyzedMove } from '../types/review';
import { MoveClassificationBadge } from './MoveClassificationBadge';
import { CLASSIFICATIONS, type MoveClassificationType } from '../types/classification';

interface EvaluationGraphProps {
  analyzedMoves: AnalyzedMove[];
  currentMoveIndex: number;
  onMoveSelect: (index: number) => void;
}

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({ analyzedMoves, currentMoveIndex, onMoveSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const height = 120;
  const paddingY = 12;
  const innerHeight = height - paddingY * 2;
  const centerY = height / 2;

  // Track actual container width to make the graph fit 100% of the container with no clipping or overflow
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    ro.observe(containerRef.current);
    if (containerRef.current.clientWidth > 0) {
      setContainerWidth(containerRef.current.clientWidth);
    }
    return () => ro.disconnect();
  }, []);

  // Points memo: start position (index -1) + all analyzed moves
  const points = useMemo(() => {
    const getWhiteCp = (move: AnalyzedMove) => {
      const score = move.evalAfter?.score;
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
      // wp = 1 -> y = paddingY (White winning, top)
      // wp = 0 -> y = innerHeight + paddingY (Black winning, bottom)
      const y = paddingY + (1 - wp) * innerHeight;
      result.push({
        index: i,
        cp,
        wp,
        y,
        move
      });
    });

    return result;
  }, [analyzedMoves, innerHeight, paddingY, centerY]);

  if (analyzedMoves.length === 0) return null;

  // The graph fills the measured container width exactly
  const width = Math.max(200, containerWidth);
  const viewBox = `0 0 ${width} ${height}`;
  const xStep = width / Math.max(1, points.length - 1);

  // Path data for evaluation curve
  const pathD = points.map((p, i) => {
    const x = i * xStep;
    return `${i === 0 ? 'M' : 'L'} ${x} ${p.y}`;
  }).join(' ');

  // Fill areas for White (above center) and Black (below center)
  const whiteAreaD = `${pathD} L ${(points.length - 1) * xStep} ${centerY} L 0 ${centerY} Z`;
  const blackAreaD = `${pathD} L ${(points.length - 1) * xStep} ${centerY} L 0 ${centerY} Z`;

  // Active point & cursor
  const activePointIndex = currentMoveIndex + 1;
  const activeX = Math.max(0, Math.min(width, activePointIndex * xStep));
  const activePoint = points[activePointIndex] || points[0];

  // Tooltip point: prioritize hovered point over active point
  const displayPoint = hoveredIndex !== null && points[hoveredIndex + 1] 
    ? points[hoveredIndex + 1] 
    : activePoint;

  const formatEval = (move: AnalyzedMove | null) => {
    if (!move) return "0.00";
    const score = move.evalAfter?.score;
    if (!score) return "0.00";
    if (score.type === 'mate') return `M${Math.abs(score.value)}`;
    const cp = score.value / 100;
    return cp > 0 ? `+${cp.toFixed(2)}` : cp.toFixed(2);
  };

  // Determine tick interval for move numbers along the bottom
  const totalMovesCount = analyzedMoves.length > 0 
    ? analyzedMoves[analyzedMoves.length - 1].moveNumber 
    : 0;
  const tickInterval = totalMovesCount > 60 ? 20 : totalMovesCount > 30 ? 10 : 5;

  const handlePointerInteraction = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = relX / rect.width;
    const targetIdx = Math.round(ratio * (points.length - 1));
    const p = points[targetIdx];
    if (p) {
      onMoveSelect(p.index);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    handlePointerInteraction(e.clientX, e.currentTarget);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = relX / rect.width;
      const targetIdx = Math.round(ratio * (points.length - 1));
      const p = points[targetIdx];
      if (p) {
        setHoveredIndex(p.index);
      }
    }
    if (e.buttons === 1) {
      handlePointerInteraction(e.clientX, e.currentTarget);
    }
  };

  const handlePointerLeave = () => {
    setHoveredIndex(null);
  };

  const markerRadius = points.length > 90 ? 2 : 2.5;

  return (
    <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-lg p-3 flex flex-col gap-2 relative shadow-sm select-none">
      {/* Header with Title and Current Move / Eval Status */}
      <div className="flex justify-between items-center text-xs px-1">
        <span className="font-bold text-content-3">Game Evaluation</span>
        {displayPoint && (
          <div className="flex items-center gap-2 text-xs">
            {displayPoint.move ? (
              <span className="font-semibold text-content-2">
                Move {displayPoint.move.moveNumber}{displayPoint.move.color === 'b' ? '...' : '.'} {displayPoint.move.san}
              </span>
            ) : (
              <span className="text-content-3">Start</span>
            )}
            <span className={`font-mono px-1.5 py-0.5 rounded text-[11px] font-bold ${
              displayPoint.cp > 75 
                ? 'bg-emerald-500/15 text-emerald-400' 
                : displayPoint.cp < -75 
                ? 'bg-rose-500/15 text-rose-400' 
                : 'bg-surface-3 text-content-1'
            }`}>
              {formatEval(displayPoint.move)}
            </span>
          </div>
        )}
      </div>
      
      {/* Container: 100% width, no overflow-x-auto, perfectly fitted */}
      <div ref={containerRef} className="relative w-full h-[120px] cursor-crosshair">
        <svg 
          viewBox={viewBox} 
          className="w-full h-full block overflow-visible"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* Center line (even evaluation) */}
          <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          
          {/* Areas */}
          <clipPath id="evalWhiteClip">
            <rect x="0" y="0" width={width} height={centerY} />
          </clipPath>
          <clipPath id="evalBlackClip">
            <rect x="0" y={centerY} width={width} height={centerY} />
          </clipPath>

          <path d={whiteAreaD} fill="rgba(255, 255, 255, 0.12)" clipPath="url(#evalWhiteClip)" />
          <path d={blackAreaD} fill="rgba(0, 0, 0, 0.35)" clipPath="url(#evalBlackClip)" />
          
          {/* Main line */}
          <path d={pathD} fill="none" stroke="var(--content-2)" strokeWidth="2" strokeLinejoin="round" />

          {/* Move Number Ticks along bottom */}
          {points.map((p, i) => {
            if (!p.move || p.move.color !== 'w' || p.move.moveNumber % tickInterval !== 0) return null;
            const x = i * xStep;
            return (
              <g key={`tick-${p.move.moveNumber}`} opacity="0.4" className="pointer-events-none">
                <line x1={x} y1={height - 8} x2={x} y2={height - 2} stroke="var(--content-3)" strokeWidth="1" />
                <text x={x} y={height - 1} textAnchor="middle" fill="var(--content-3)" fontSize="8" fontFamily="monospace">
                  {p.move.moveNumber}
                </text>
              </g>
            );
          })}

          {/* Classification Markers */}
          {points.map((p, i) => {
            if (!p.move || !p.move.classification) return null;
            
            const interesting = ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'blunder', 'miss'];
            if (!interesting.includes(p.move.classification)) return null;
            
            const classificationStr = p.move.classification as any as MoveClassificationType;
            const classification = CLASSIFICATIONS[classificationStr];
            if (!classification) return null;

            let color = '#94a3b8';
            if (classificationStr === 'brilliant') color = '#2dd4bf'; // teal-400
            else if (classificationStr === 'great') color = '#3b82f6'; // blue-500
            else if (classificationStr === 'best') color = '#22c55e'; // green-500
            else if (classificationStr === 'inaccuracy') color = '#eab308'; // yellow-500
            else if (classificationStr === 'mistake') color = '#f97316'; // orange-500
            else if (classificationStr === 'miss') color = '#f87171'; // red-400
            else if (classificationStr === 'blunder') color = '#ef4444'; // red-500

            const x = i * xStep;
            return (
              <circle 
                key={`marker-${p.index}`} 
                cx={x} 
                cy={p.y} 
                r={markerRadius} 
                fill={color} 
                stroke="var(--bg-surface-2)" 
                strokeWidth="1" 
                className="pointer-events-none" 
              />
            );
          })}

          {/* Active indicator line & circle */}
          <line x1={activeX} y1={0} x2={activeX} y2={height} stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.8" />
          <circle cx={activeX} cy={activePoint?.y || centerY} r="4" fill="var(--accent-primary)" stroke="white" strokeWidth="1" />

          {/* Hover indicator (if hovering different point) */}
          {hoveredIndex !== null && hoveredIndex !== currentMoveIndex && (
            <line 
              x1={(hoveredIndex + 1) * xStep} 
              y1={0} 
              x2={(hoveredIndex + 1) * xStep} 
              y2={height} 
              stroke="var(--content-1)" 
              strokeWidth="1" 
              strokeDasharray="2 2" 
              opacity="0.5" 
            />
          )}
        </svg>
      </div>

      {/* Dynamic Hover / Active Card Detail */}
      {displayPoint && displayPoint.move && displayPoint.move.classification && (
        <div className="flex items-center justify-between text-[11px] bg-surface-2/60 px-2 py-1 rounded border border-border-1/40">
          <div className="flex items-center gap-1.5 font-medium">
            <MoveClassificationBadge classification={displayPoint.move.classification as any} />
            <span className="text-content-1 font-semibold">{displayPoint.move.san}</span>
            <span className="text-content-3">({CLASSIFICATIONS[displayPoint.move.classification as any as MoveClassificationType]?.name || displayPoint.move.classification})</span>
          </div>
          {displayPoint.move.accuracy !== undefined && (
            <span className="text-content-3 font-mono">
              Acc: <span className="text-content-1 font-bold">{displayPoint.move.accuracy.toFixed(1)}%</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
