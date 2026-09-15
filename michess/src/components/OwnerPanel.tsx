import React from 'react';
import { Skull, Move, Trash2, SwitchCamera, Play, RotateCcw, CopyX, Edit3, Trash, RefreshCw, Pause } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';

interface OwnerPanelProps {
  isChaos: boolean;
  onToggleChaos: () => void;
  // Controls
  onSpawnPiece?: () => void;
  onRemovePiece?: () => void;
  onReplacePiece?: () => void;
  onFreeMoveToggle?: (enabled: boolean) => void;
  onIgnoreTurnToggle?: (enabled: boolean) => void;
  onSwitchTurn?: () => void;
  onResetPosition?: () => void;
  onClearBoard?: () => void;
  onPauseClock?: () => void;
  onResumeClock?: () => void;
  onResetClock?: () => void;
  freeMoveActive?: boolean;
  ignoreTurnActive?: boolean;
  chaosAction: 'none'|'spawn'|'remove'|'replace';
  spawnPiece: {type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b'};
  setSpawnPiece: (p: {type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b'}) => void;
}

export const OwnerPanel: React.FC<OwnerPanelProps> = ({
  isChaos,
  onToggleChaos,
  onSpawnPiece,
  onRemovePiece,
  onReplacePiece,
  onFreeMoveToggle,
  onIgnoreTurnToggle,
  onSwitchTurn,
  onResetPosition,
  onClearBoard,
  onPauseClock,
  onResumeClock,
  onResetClock,
  freeMoveActive = false,
  ignoreTurnActive = false,
  chaosAction,
  spawnPiece,
  setSpawnPiece,
}) => {
  const { isOwner } = useProfile();

  if (!isOwner) return null;

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-xl p-4 flex flex-col gap-4 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
      <div className="flex justify-between items-center border-b border-indigo-500/30 pb-3">
        <h3 className="font-black text-indigo-400 tracking-wider flex items-center gap-2">
          <Skull size={18} /> OWNER MODE
        </h3>
        <button
          onClick={onToggleChaos}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-colors border ${
            isChaos 
              ? 'bg-indigo-900/50 text-indigo-300 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.3)] animate-pulse' 
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
        >
          {isChaos ? 'CHAOS ACTIVE' : 'NORMAL CHESS'}
        </button>
      </div>

      {isChaos && (
        <div className="flex flex-col gap-4 text-sm animate-fade-in">
          
          {/* Pieces */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Pieces</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <ToggleBtn icon={<CopyX />} label="Spawn" active={chaosAction === 'spawn'} onClick={onSpawnPiece} />
              <ToggleBtn icon={<Trash2 />} label="Remove" active={chaosAction === 'remove'} onClick={onRemovePiece} />
              <ToggleBtn icon={<Edit3 />} label="Replace" active={chaosAction === 'replace'} onClick={onReplacePiece} />
            </div>
            {(chaosAction === 'spawn' || chaosAction === 'replace') && (
              <div className="flex gap-2 items-center bg-slate-800 p-2 rounded justify-center mb-2 animate-fade-in">
                 {(['w', 'b'] as const).map(c => (
                   <div key={c} className="flex gap-1 border-r border-slate-700 pr-2 last:border-0 last:pr-0">
                     {(['p','n','b','r','q','k'] as const).map(p => {
                       const isSelected = spawnPiece.type === p && spawnPiece.color === c;
                       return (
                         <button 
                           key={p} 
                           onClick={() => setSpawnPiece({type: p, color: c})}
                           className={`w-8 h-8 flex items-center justify-center rounded ${isSelected ? 'bg-indigo-500 shadow' : 'hover:bg-slate-700'}`}
                         >
                            <img src={`/assets/pieces/standard/${c}${p.toUpperCase()}.svg`} alt={`${c}${p}`} className="w-6 h-6" />
                         </button>
                       );
                     })}
                   </div>
                 ))}
              </div>
            )}
            {chaosAction !== 'none' && (
              <div className="text-xs text-center text-indigo-400 animate-pulse font-bold">
                Click a square on the board to {chaosAction}.
              </div>
            )}
          </div>

          {/* Movement */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Movement</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <ToggleBtn icon={<Move />} label="Free Move" active={freeMoveActive} onClick={() => onFreeMoveToggle?.(!freeMoveActive)} />
              <ToggleBtn icon={<SwitchCamera />} label="Ignore Turn" active={ignoreTurnActive} onClick={() => onIgnoreTurnToggle?.(!ignoreTurnActive)} />
            </div>
          </div>

          {/* Game */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Game</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <ControlBtn icon={<SwitchCamera />} label="Switch Turn" onClick={onSwitchTurn} />
              <ControlBtn icon={<RefreshCw />} label="Reset Pos" onClick={onResetPosition} />
              <ControlBtn icon={<Trash />} label="Clear Board" onClick={onClearBoard} />
            </div>
          </div>

          {/* Clock */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Clock</h4>
            <div className="grid grid-cols-3 gap-2">
              <ControlBtn icon={<Pause />} label="Pause" onClick={onPauseClock} />
              <ControlBtn icon={<Play />} label="Resume" onClick={onResumeClock} />
              <ControlBtn icon={<RotateCcw />} label="Reset" onClick={onResetClock} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

const ControlBtn = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded text-slate-300 hover:text-white transition-colors justify-center"
  >
    {React.cloneElement(icon as React.ReactElement, { size: 14 } as any)}
    <span className="font-bold">{label}</span>
  </button>
);

const ToggleBtn = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 p-2 rounded transition-colors justify-center font-bold border ${
      active 
        ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
    }`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 14 } as any)}
    <span>{label}</span>
  </button>
);
