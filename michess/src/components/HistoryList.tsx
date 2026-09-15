import React, { useState, useMemo } from 'react';
import { Clock, Search, Trash2, ShieldAlert, Play, BookOpen, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import type { HistoryGame } from '../types/history';

interface HistoryListProps {
  history: HistoryGame[];
  onReview: (pgn: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onReview, onRemove, onClear, onClose }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredHistory = useMemo(() => {
    let result = [...history];

    // Filter by source
    if (filter !== 'all') {
      result = result.filter(g => g.source === filter);
    }

    // Search by players
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(g => 
        g.white.toLowerCase().includes(s) || 
        g.black.toLowerCase().includes(s) ||
        (g.event && g.event.toLowerCase().includes(s))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOrder === 'newest') return b.timestamp - a.timestamp;
      return a.timestamp - b.timestamp;
    });

    return result;
  }, [history, search, filter, sortOrder]);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear your local game history? This will NOT delete the review cache or settings.')) {
      onClear();
    }
  };

  const handleRemove = (id: string) => {
    if (window.confirm('Delete this game from history?')) {
      onRemove(id);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto h-full px-4 pb-20 animate-fade-in">
      <div className="flex justify-between items-center mb-6 mt-4">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <Clock className="text-chess-accent" size={32} />
          Game History
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors font-bold px-4 py-2 border border-slate-700 rounded-lg bg-slate-800">
          Back to Home
        </button>
      </div>

      <div className="bg-chess-panel border border-chess-border rounded-xl p-6 shadow-2xl mb-6 animate-slide-up">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-3 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search players or event..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pl-10 text-slate-300 focus:outline-none focus:border-chess-accent"
            />
          </div>
          
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-chess-accent"
          >
            <option value="all">All Sources</option>
            <option value="local">Local Play</option>
            <option value="computer">Vs Computer</option>
            <option value="import">Imported</option>
          </select>

          <select 
            value={sortOrder} 
            onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-chess-accent"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <button 
            onClick={handleClear} 
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 border border-red-900 rounded-lg hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            <ShieldAlert size={18} /> Clear History
          </button>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <BookOpen size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-300 mb-2">No games found</h3>
            <p className="text-slate-500">Play a game or import one to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredHistory.map(game => (
              <div key={game.id} className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group hover:border-slate-500 transition-colors">
                
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between md:justify-start items-center gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-900 px-2 py-1 rounded">
                        {game.source}
                      </span>
                      {game.is_chaos && (
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 bg-indigo-900/50 border border-indigo-500/50 px-2 py-1 rounded shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                          CHAOS
                        </span>
                      )}
                      {game.syncStatus === 'synced' && (
                        <span className="text-emerald-500" title="Synced to cloud"><Cloud size={14} /></span>
                      )}
                      {game.syncStatus === 'pending' && (
                        <span className="text-yellow-500" title="Pending sync"><RefreshCw size={14} className="animate-spin-slow" /></span>
                      )}
                      {(!game.syncStatus || game.syncStatus === 'local') && (
                        <span className="text-slate-500" title="Local only"><CloudOff size={14} /></span>
                      )}
                    </div>
                    <span className="text-sm text-slate-400">{new Date(game.timestamp).toLocaleDateString()} • {game.moveCount} moves</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-lg">
                    <div className="font-bold text-white truncate min-w-0" title={game.white}>
                      <span className="inline-block w-3 h-3 bg-white border border-gray-400 rounded-sm mr-2"></span>
                      {game.white}
                    </div>
                    <span className="font-bold text-slate-500 text-sm flex-shrink-0">vs</span>
                    <div className="font-bold text-slate-300 truncate min-w-0" title={game.black}>
                      <span className="inline-block w-3 h-3 bg-black border border-gray-600 rounded-sm mr-2 mt-1"></span>
                      {game.black}
                    </div>
                  </div>
                  
                  {game.opening && game.opening !== 'Unknown' && (
                    <div className="text-sm text-slate-500 mt-2 truncate">
                      {game.opening}
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto shrink-0">
                  <div className="font-mono text-xl font-bold text-chess-accent bg-slate-900 px-4 py-2 rounded-lg text-center w-full md:w-auto">
                    {game.result}
                  </div>

                  {game.reviewed && (game.whiteAccuracy || game.blackAccuracy) && (
                    <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-lg px-3 py-1.5 border border-slate-700 min-w-[80px]">
                      <span className="text-xs text-slate-400 mb-0.5">Accuracy</span>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-white">{game.whiteAccuracy ? game.whiteAccuracy.toFixed(1) : '-'}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-slate-300">{game.blackAccuracy ? game.blackAccuracy.toFixed(1) : '-'}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex w-full md:w-auto gap-2">
                    {!game.is_chaos && (
                      <button 
                        onClick={() => onReview(game.pgn)}
                        className="flex-1 md:flex-none bg-chess-accent hover:bg-indigo-500 px-6 py-3 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Play size={18} /> Review
                      </button>
                    )}
                    <button 
                      onClick={() => handleRemove(game.id)}
                      className="px-4 bg-slate-700 hover:bg-red-600 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                      title="Delete from History"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
