import React, { useState, useRef } from 'react';
import { Upload, FileText, Link as LinkIcon, AlertTriangle, CheckCircle2, Search, Play, Users, Trash2 } from 'lucide-react';
import { parsePgnMetadata, fetchLichessGame, fetchChesscomGame, fetchLichessUserGames, fetchChesscomUserGames, type ImportedGameMeta } from '../utils/importUtils';
import { useImportQueue } from '../hooks/useImportQueue';

interface ImportGameProps {
  onCancel: () => void;
  onReview: (pgn: string, gameInfo?: any) => void;
}

type MainMode = 'game' | 'user';
type GameTab = 'paste' | 'lichess' | 'chesscom';
type UserTab = 'lichess' | 'chesscom';

export const ImportGame: React.FC<ImportGameProps> = ({ onCancel, onReview }) => {
  const [mode, setMode] = useState<MainMode>('game');
  
  // Game Import State
  const [gameTab, setGameTab] = useState<GameTab>('paste');
  const [pgnInput, setPgnInput] = useState('');
  const [gameUrl, setGameUrl] = useState('');
  
  // User Import State
  const [userTab, setUserTab] = useState<UserTab>('chesscom');
  const [username, setUsername] = useState('');
  const [maxGames, setMaxGames] = useState<number>(10);
  const [fetchedGames, setFetchedGames] = useState<ImportedGameMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Shared Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { queue, addGames, removeGame, clearQueue } = useImportQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Game Import Logic ===
  
  const validatePgn = (pgn: string) => {
    if (!pgn.trim()) {
      setError('PGN cannot be empty.');
      return;
    }
    const meta = parsePgnMetadata(pgn);
    if (meta.isValid) {
      addGames([meta]);
      setPgnInput('');
      setGameUrl('');
      setError(null);
    } else {
      setError(meta.error || 'Invalid PGN');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        validatePgn(text);
      }
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFetchGameUrl = async () => {
    if (!gameUrl.trim()) {
      setError('URL cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let pgn = '';
      if (gameTab === 'lichess') pgn = await fetchLichessGame(gameUrl);
      else if (gameTab === 'chesscom') pgn = await fetchChesscomGame(gameUrl);
      validatePgn(pgn);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch game.');
    } finally {
      setLoading(false);
    }
  };

  // === User Import Logic ===

  const handleFetchUserGames = async () => {
    if (!username.trim()) {
      setError('Username cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    setFetchedGames([]);
    setSelectedIds(new Set());

    try {
      let games: ImportedGameMeta[] = [];
      if (userTab === 'lichess') games = await fetchLichessUserGames(username.trim(), maxGames);
      else if (userTab === 'chesscom') games = await fetchChesscomUserGames(username.trim(), maxGames);
      
      setFetchedGames(games);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user games.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === fetchedGames.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(fetchedGames.map(g => g.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleImportSelected = () => {
    const toImport = fetchedGames.filter(g => selectedIds.has(g.id));
    addGames(toImport);
    setFetchedGames([]); // Clear list after import
    setSelectedIds(new Set());
  };

  // === UI Renders ===

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto h-full px-4 pb-20 animate-fade-in mt-6 md:mt-10">
      <div className="w-full bg-surface-2 border border-border-1 rounded-xl p-6 md:p-8 relative overflow-hidden shadow-2xl animate-slide-up mb-6">
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex gap-4">
            <button
              onClick={() => { setMode('game'); setError(null); }}
              className={`text-xl font-bold flex items-center gap-2 pb-2 border-b-2 transition-colors ${mode === 'game' ? 'border-accent text-content-1' : 'border-transparent text-content-3 hover:text-slate-200'}`}
            >
              <Upload size={22} /> Import Game
            </button>
            <button
              onClick={() => { setMode('user'); setError(null); }}
              className={`text-xl font-bold flex items-center gap-2 pb-2 border-b-2 transition-colors ${mode === 'user' ? 'border-accent text-content-1' : 'border-transparent text-content-3 hover:text-slate-200'}`}
            >
              <Users size={22} /> Import User
            </button>
          </div>
          <button onClick={onCancel} className="text-content-3 hover:text-content-1 transition-colors">Close</button>
        </div>

        {/* --- GAME IMPORT MODE --- */}
        {mode === 'game' && (
          <div>
            <div className="flex gap-2 mb-6 border-b border-border-1 pb-1">
              <button onClick={() => { setGameTab('paste'); setError(null); }} className={`px-4 py-2 font-bold border-b-2 transition-colors ${gameTab === 'paste' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-slate-200'}`}>Paste PGN</button>
              <button onClick={() => { setGameTab('chesscom'); setError(null); }} className={`px-4 py-2 font-bold border-b-2 transition-colors ${gameTab === 'chesscom' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-slate-200'}`}>Chess.com URL</button>
              <button onClick={() => { setGameTab('lichess'); setError(null); }} className={`px-4 py-2 font-bold border-b-2 transition-colors ${gameTab === 'lichess' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-slate-200'}`}>Lichess URL</button>
            </div>

            {gameTab === 'paste' ? (
              <div className="flex flex-col gap-4">
                <textarea
                  value={pgnInput}
                  onChange={(e) => setPgnInput(e.target.value)}
                  placeholder="[Event &quot;Live Chess&quot;]&#10;1. e4 e5..."
                  className="w-full h-48 bg-surface-1 border border-border-1 rounded-lg p-3 text-content-2 font-mono text-sm resize-none focus:outline-none focus:border-chess-accent"
                />
                <div className="flex gap-4">
                  <button onClick={() => validatePgn(pgnInput)} disabled={!pgnInput.trim()} className="flex-1 bg-accent hover:bg-accent-hover py-3 rounded-lg font-bold text-content-1 transition-colors disabled:opacity-50">Parse PGN</button>
                  <input type="file" accept=".pgn" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-surface-3 hover:bg-surface-3 py-3 rounded-lg font-bold text-slate-200 transition-colors flex justify-center items-center gap-2"><FileText size={18} /> Upload .pgn</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-content-3 text-sm">Enter the public URL of the game.</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={16} className="absolute left-3 top-3.5 text-content-3" />
                    <input type="text" value={gameUrl} onChange={(e) => setGameUrl(e.target.value)} placeholder="https://" className="w-full bg-surface-1 border border-border-1 rounded-lg p-3 pl-10 text-content-2 focus:outline-none focus:border-chess-accent" />
                  </div>
                  <button onClick={handleFetchGameUrl} disabled={loading || !gameUrl.trim()} className={`px-6 rounded-lg font-bold text-content-1 transition-colors flex justify-center items-center min-w-[120px] disabled:opacity-50 bg-accent hover:bg-accent-hover`}>
                    {loading ? <Search className="animate-spin" size={20} /> : 'Import'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- USER IMPORT MODE --- */}
        {mode === 'user' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-bold text-content-3 mb-2">Platform</label>
                <div className="flex bg-surface-2 rounded-lg p-1">
                  <button onClick={() => { setUserTab('chesscom'); setFetchedGames([]); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${userTab === 'chesscom' ? 'bg-surface-3 text-content-1 shadow' : 'text-content-3 hover:text-content-1'}`}>Chess.com</button>
                  <button onClick={() => { setUserTab('lichess'); setFetchedGames([]); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${userTab === 'lichess' ? 'bg-surface-3 text-content-1 shadow' : 'text-content-3 hover:text-content-1'}`}>Lichess</button>
                </div>
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-sm font-bold text-content-3 mb-2">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={userTab === 'chesscom' ? 'e.g. Hikaru' : 'e.g. DrNykterstein'} className="w-full bg-surface-1 border border-border-1 rounded-lg p-2.5 text-content-2 focus:outline-none focus:border-chess-accent" onKeyDown={e => e.key === 'Enter' && handleFetchUserGames()} />
              </div>
              <div>
                <label className="block text-sm font-bold text-content-3 mb-2">Games</label>
                <select value={maxGames} onChange={e => setMaxGames(Number(e.target.value))} className="w-24 bg-surface-1 border border-border-1 rounded-lg p-2.5 text-content-2 focus:outline-none focus:border-chess-accent">
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <button onClick={handleFetchUserGames} disabled={loading || !username.trim()} className="h-11 px-6 bg-accent hover:bg-accent-hover rounded-lg font-bold text-content-1 transition-colors disabled:opacity-50 flex items-center gap-2">
                {loading ? <Search className="animate-spin" size={18} /> : 'Fetch Games'}
              </button>
            </div>

            {fetchedGames.length > 0 && (
              <div className="mt-4 border border-border-1 rounded-lg overflow-hidden animate-fade-in">
                <div className="bg-surface-2 p-3 flex justify-between items-center border-b border-border-1">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedIds.size === fetchedGames.length} onChange={handleSelectAll} className="w-4 h-4 cursor-pointer accent-chess-accent" />
                    <span className="font-bold text-slate-200 text-sm">Select All</span>
                  </div>
                  <span className="text-sm text-content-3 font-bold">{fetchedGames.length} Games Found</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto bg-surface-1/50">
                  {fetchedGames.map((game, i) => (
                    <label key={game.id || i} className="flex items-center gap-4 p-3 border-b border-border-1/50 hover:bg-slate-800/50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={selectedIds.has(game.id)} onChange={() => handleToggleSelect(game.id)} className="w-4 h-4 accent-chess-accent" />
                      <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-4 font-bold truncate"><span className="w-3 h-3 inline-block bg-white border border-gray-400 rounded-sm mr-1"></span>{game.white} <br/><span className="w-3 h-3 inline-block bg-black border border-gray-600 rounded-sm mr-1 mt-1"></span>{game.black}</div>
                        <div className="col-span-2 text-content-3 flex items-center">{game.result}</div>
                        <div className="col-span-3 text-content-3 flex flex-col justify-center text-xs truncate">
                          <span>{game.date !== 'Unknown' ? game.date : ''}</span>
                        </div>
                        <div className="col-span-3 text-content-3 flex flex-col justify-center text-xs truncate">
                          <span>{game.opening !== 'Unknown' ? game.opening : ''}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="bg-surface-2 p-3 flex justify-end">
                  <button onClick={handleImportSelected} disabled={selectedIds.size === 0} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-content-1 transition-colors disabled:opacity-50 flex items-center gap-2">
                    <Upload size={16} /> Import Selected ({selectedIds.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-error/10 border border-red-800 rounded-lg flex gap-3 text-error text-sm animate-fade-in">
            <AlertTriangle className="shrink-0" size={18} />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* --- IMPORT QUEUE --- */}
      {queue.length > 0 && (
        <div className="w-full bg-surface-2 border border-border-1 rounded-xl p-6 shadow-2xl animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-success flex items-center gap-2"><CheckCircle2 size={20} /> Ready to Review ({queue.length})</h3>
            <button onClick={clearQueue} className="text-sm text-error hover:text-red-300 font-bold flex items-center gap-1 transition-colors"><Trash2 size={14} /> Clear All</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queue.map((game, idx) => (
              <div key={game.id + idx} className="bg-surface-2 border border-border-1 p-4 rounded-lg flex flex-col gap-3 group hover:border-slate-500 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-content-1 truncate text-sm mb-1" title={game.white}>⚪ {game.white}</div>
                    <div className="font-bold text-content-2 truncate text-sm" title={game.black}>⚫ {game.black}</div>
                  </div>
                  <div className="font-mono text-lg font-bold text-accent bg-surface-1 px-2 py-1 rounded ml-2 whitespace-nowrap">{game.result}</div>
                </div>
                
                <div className="flex gap-2">
                  <button onClick={() => onReview(game.pgn, { ...game, source: 'import' })} className="flex-1 bg-accent hover:bg-accent-hover py-2 rounded font-bold text-content-1 text-sm transition-colors flex justify-center items-center gap-2"><Play size={16} /> Review</button>
                  <button onClick={() => removeGame(game.id)} className="px-3 bg-surface-3 hover:bg-red-600/80 rounded transition-colors text-content-2 hover:text-content-1" title="Remove"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
