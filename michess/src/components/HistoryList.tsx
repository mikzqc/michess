import React, { useState, useMemo } from 'react';
import { Clock, Search, Trash2, ShieldAlert, Play, BookOpen, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import type { HistoryGame } from '../types/history';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface HistoryListProps {
  history: HistoryGame[];
  onReview: (pgn: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  onViewProfile?: (username: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onReview, onRemove, onClear, onClose, onViewProfile }) => {
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
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 h-full flex flex-col py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-black text-content-1 flex items-center gap-3">
          <Clock className="text-accent" size={32} />
          Game History
        </h2>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-6 shadow-sm mb-6 animate-slide-up">
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex-1 min-w-[200px]">
            <Input 
              type="text" 
              placeholder="Search players or event..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
          
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            className="bg-surface-1 border border-border-1 rounded-lg p-2.5 text-content-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="all">All Sources</option>
            <option value="local">Local Play</option>
            <option value="computer">Vs Computer</option>
            <option value="import">Imported</option>
          </select>

          <select 
            value={sortOrder} 
            onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="bg-surface-1 border border-border-1 rounded-lg p-2.5 text-content-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <Button 
            variant="destructive"
            onClick={handleClear} 
            disabled={history.length === 0}
            className="h-10"
          >
            <ShieldAlert size={18} className="mr-2" /> Clear History
          </Button>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-16 bg-surface-1/50 rounded-lg border border-border-1 border-dashed">
            <BookOpen size={48} className="mx-auto text-content-3 mb-4" />
            <h3 className="text-xl font-bold text-content-1 mb-2">No games found</h3>
            <p className="text-content-3">Play a game or import one to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredHistory.map(game => (
              <div key={game.id} className="bg-surface-1 border border-border-1 hover:border-border-2 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group transition-colors shadow-sm">
                
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between md:justify-start items-center gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-content-3 bg-surface-3 px-2 py-1 rounded">
                        {game.source}
                      </span>
                      {game.syncStatus === 'synced' && (
                        <span className="text-success" title="Synced to cloud"><Cloud size={14} /></span>
                      )}
                      {game.syncStatus === 'pending' && (
                        <span className="text-warning" title="Pending sync"><RefreshCw size={14} className="animate-spin-slow" /></span>
                      )}
                      {(!game.syncStatus || game.syncStatus === 'local') && (
                        <span className="text-content-3" title="Local only"><CloudOff size={14} /></span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-content-3">{new Date(game.timestamp).toLocaleDateString()} • {game.moveCount} moves</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-lg">
                    <div 
                      className={`font-bold text-content-1 truncate min-w-0 flex items-center ${onViewProfile && game.white !== 'Stockfish' && game.white !== 'Local Player' ? 'cursor-pointer hover:text-accent hover:underline' : ''}`}
                      onClick={() => onViewProfile && game.white !== 'Stockfish' && game.white !== 'Local Player' && onViewProfile(game.white)}
                      title={game.white}
                    >
                      <span className="inline-block w-3 h-3 bg-white border border-gray-400 rounded-sm mr-2 shrink-0 shadow-sm"></span>
                      <span className="truncate">{game.white}</span>
                    </div>
                    <span className="font-bold text-content-3 text-sm flex-shrink-0">vs</span>
                    <div 
                      className={`font-bold text-content-2 truncate min-w-0 flex items-center ${onViewProfile && game.black !== 'Stockfish' && game.black !== 'Local Player' ? 'cursor-pointer hover:text-accent hover:underline' : ''}`}
                      onClick={() => onViewProfile && game.black !== 'Stockfish' && game.black !== 'Local Player' && onViewProfile(game.black)}
                      title={game.black}
                    >
                      <span className="inline-block w-3 h-3 bg-black border border-gray-600 rounded-sm mr-2 mt-1 shrink-0 shadow-sm"></span>
                      <span className="truncate">{game.black}</span>
                    </div>
                  </div>
                  
                  {game.opening && game.opening !== 'Unknown' && (
                    <div className="text-sm text-content-3 mt-2 truncate">
                      {game.opening}
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto shrink-0">
                  <div className="font-mono text-xl font-bold text-accent bg-surface-3 px-4 py-2 rounded-lg text-center w-full md:w-auto">
                    {game.result}
                  </div>

                  {Boolean(game.reviewed && (game.whiteAccuracy != null || game.blackAccuracy != null)) && (
                    <div className="flex flex-col items-center justify-center bg-surface-3 rounded-lg px-3 py-1.5 min-w-[80px]">
                      <span className="text-xs text-content-3 mb-0.5">Accuracy</span>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-content-1">{game.whiteAccuracy != null ? game.whiteAccuracy.toFixed(1) : '-'}</span>
                        <span className="text-content-3">/</span>
                        <span className="text-content-2">{game.blackAccuracy != null ? game.blackAccuracy.toFixed(1) : '-'}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex w-full md:w-auto gap-2">
                    <Button 
                      onClick={() => onReview(game.pgn)}
                      className="flex-1 md:flex-none"
                    >
                      <Play size={18} className="mr-2" /> Review
                    </Button>
                    <Button 
                      onClick={() => handleRemove(game.id)}
                      variant="ghost"
                      className="px-3 hover:text-error hover:bg-error/10"
                      title="Delete from History"
                    >
                      <Trash2 size={18} />
                    </Button>
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
