import React from 'react';
import { Clock } from 'lucide-react';

interface ChessClockProps {
  timeMs: number;
  isActive: boolean;
  isPlayerClock?: boolean;
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const ChessClock: React.FC<ChessClockProps> = ({ timeMs, isActive }) => {
  const isLow = timeMs <= 60000 && timeMs > 10000;   // ≤ 60s
  const isCritical = timeMs <= 10000 && timeMs > 0;    // ≤ 10s
  const isExpired = timeMs <= 0;

  let bgColor = 'bg-slate-800';
  let textColor = 'text-white';
  let borderColor = 'border-slate-700';
  let extraClasses = '';

  if (isExpired) {
    bgColor = 'bg-red-900/40';
    textColor = 'text-red-400';
    borderColor = 'border-red-800';
  } else if (isCritical && isActive) {
    bgColor = 'bg-red-900/30';
    textColor = 'text-red-400';
    borderColor = 'border-red-800';
    extraClasses = 'animate-pulse';
  } else if (isLow && isActive) {
    bgColor = 'bg-amber-900/20';
    textColor = 'text-amber-400';
    borderColor = 'border-amber-800/50';
  } else if (isActive) {
    bgColor = 'bg-chess-accent/20';
    textColor = 'text-white';
    borderColor = 'border-chess-accent/50';
  }

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-1 sm:gap-2 font-mono tabular-nums ${extraClasses} transition-colors duration-200`}>
      {isActive && <Clock size={14} className={`${textColor} opacity-70 hidden sm:block`} />}
      <span className={`text-lg sm:text-xl font-bold ${textColor}`}>
        {formatTime(timeMs)}
      </span>
    </div>
  );
};
