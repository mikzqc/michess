import { useState, useCallback } from 'react';
import { PlayArea } from './components/PlayArea';
import { GameSetupModal, type SetupMode, type TimeControl } from './components/GameSetupModal';
import { ComputerPlayArea } from './components/ComputerPlayArea';
import { ImportGame } from './components/ImportGame';
import type { Difficulty, PlayerColor } from './hooks/useComputerGame';
import { Swords, Bot, Settings as SettingsIcon, Upload, Clock } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ReviewArea } from './components/ReviewArea';
import { useHistory } from './hooks/useHistory';
import { HistoryList } from './components/HistoryList';
import type { HistoryGame } from './types/history';
import { useAuth } from './hooks/useAuth';
import { AuthModal } from './components/AuthModal';
import { ProfileArea } from './components/ProfileArea';
import { LinkPlayArea } from './components/LinkPlayArea';
import { useProfile } from './hooks/useProfile';
import { supabase } from './services/supabase';
import { generateUUID } from './utils/uuid';
import { useEffect } from 'react';
import { Link } from 'lucide-react';
import { useToast } from './components/Toast';

type ViewState = 'home' | 'local' | 'setup-computer' | 'play-computer' | 'review' | 'import' | 'history' | 'profile' | 'link-game';

function App() {
  const [view, setView] = useState<ViewState>('home');
  const [previousView, setPreviousView] = useState<ViewState>('home');
  const [computerConfig, setComputerConfig] = useState<{ color: PlayerColor, difficulty: Difficulty } | null>(null);
  const [gameTimeControl, setGameTimeControl] = useState<TimeControl | null>(null);
  const [reviewPgn, setReviewPgn] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [linkInviteCode, setLinkInviteCode] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const { addToast } = useToast();
  const { profile } = useProfile();

  const { user, loading: authLoading } = useAuth();
  const { history, addGame, removeGame, clearHistory, updateGameReviewStats, migrateLocalGames, skipMigration, needsMigration } = useHistory();

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/play\/link\/([a-zA-Z0-9_-]+)$/);
    if (match) {
      setLinkInviteCode(match[1]);
      setView('link-game');
    }
  }, []);

  const handleSetView = (v: ViewState) => {
    if (v === 'home') {
      window.history.pushState({}, '', '/');
    }
    setView(v);
  };

  const handleCreateLinkGame = async (preferredColor: PlayerColor, timeControl: TimeControl | null = null) => {
    if (!supabase) {
      addToast("Database not configured", "error");
      return;
    }
    
    // Retrieve or generate guest ID if not logged in
    let guestId = localStorage.getItem('michess_guest_id');
    if (!guestId) {
      guestId = generateUUID();
      localStorage.setItem('michess_guest_id', guestId);
    }
    const playerId = user?.id || guestId;
    
    const inviteCode = Math.random().toString(36).substring(2, 9);
    const isWhite = preferredColor === 'white';
    
    try {
      const rpcParams: any = {
        p_invite_code: inviteCode,
        p_creator_id: playerId,
        p_is_white: isWhite,
        p_time_control: timeControl ? `${timeControl.minutes}+${timeControl.increment}` : null,
        p_initial_time_ms: timeControl ? timeControl.minutes * 60 * 1000 : null,
        p_increment_ms: timeControl ? timeControl.increment * 1000 : 0
      };

      const { error } = await supabase.rpc('create_link_game', rpcParams);
      
      if (error) throw error;
      
      window.history.pushState({}, '', `/play/link/${inviteCode}`);
      setLinkInviteCode(inviteCode);
      setView('link-game');
    } catch (err: any) {
      addToast("Failed to create game: " + err.message, "error");
    }
  };

  const startComputerGame = (color: PlayerColor, difficulty: Difficulty, tc: TimeControl | null = null) => {
    setComputerConfig({ color, difficulty });
    setGameTimeControl(tc);
    setView('play-computer');
  };

  const startReview = (pgn: string, gameInfo?: Omit<HistoryGame, 'id' | 'timestamp' | 'reviewed'>) => {
    if (gameInfo) {
      addGame(gameInfo);
    }
    setReviewPgn(pgn);
    setPreviousView(view);
    setView('review');
  };

  const handleReviewComplete = useCallback((pgn: string, stats: any) => {
    updateGameReviewStats(pgn, stats);
  }, [updateGameReviewStats]);

  const handleSaveGame = (pgn: string, white: string, black: string, result: string, date: string, event: string, is_chaos?: boolean) => {
    const isComputer = view === 'play-computer';
    addGame({
      pgn,
      white,
      black,
      result,
      date,
      event,
      source: isComputer ? 'computer' : 'local',
      moveCount: pgn.split('. ').length - 1,
      is_chaos
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-chess-panel border-b border-chess-border px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4 relative z-50">
        <h1 
          className="text-2xl font-bold tracking-wider text-white cursor-pointer flex items-center gap-2 active:scale-95 transition-transform shrink-0"
          onClick={() => handleSetView('home')}
        >
          <Swords className="text-chess-accent" />
          <span>Mi<span className="text-chess-accent">chess</span></span>
        </h1>
        <nav className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar flex-nowrap w-full sm:w-auto">
          <button 
            onClick={() => setShowSettings(true)}
            className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors flex items-center justify-center active:scale-95"
            title="Settings"
            aria-label="Open Settings"
          >
            <SettingsIcon size={20} />
          </button>

          <div className="h-6 w-px bg-slate-700 hidden md:block"></div>

          <button 
            onClick={() => handleSetView('history')} 
            className={`transition-colors font-semibold flex items-center gap-2 text-[15px] active:scale-95 px-3 py-2 rounded-lg ${view === 'history' ? 'text-chess-accent bg-chess-accent/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          >
            <Clock size={18} /> History
          </button>

          <button 
            onClick={() => setSetupMode('computer')} 
            className={`transition-colors font-semibold flex items-center gap-2 text-[15px] active:scale-95 px-3 py-2 rounded-lg ${view === 'play-computer' ? 'text-chess-accent bg-chess-accent/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          >
            <Bot size={18} /> Play vs Computer
          </button>
          
          <button 
            onClick={() => setSetupMode('local')} 
            className={`transition-colors font-semibold flex items-center gap-2 text-[15px] active:scale-95 px-3 py-2 rounded-lg ${view === 'local' ? 'text-chess-accent bg-chess-accent/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          >
            <Swords size={18} /> Local Play
          </button>

          {!authLoading && (
            <div className="ml-1 sm:ml-2 pl-3 sm:pl-6 border-l border-slate-700 shrink-0">
              {user ? (
                <button 
                  onClick={() => handleSetView('profile')}
                  className={`px-4 py-2 rounded-lg border transition-colors font-bold text-sm active:scale-95 ${view === 'profile' ? 'bg-chess-accent border-chess-accent text-white' : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-chess-accent'}`}
                >
                  {profile?.username || user.email?.split('@')[0] || 'Profile'}
                </button>
              ) : (
                <button 
                  onClick={() => setShowAuth(true)}
                  className="bg-chess-accent hover:bg-indigo-500 px-5 py-2 rounded-lg transition-colors font-bold text-sm text-white active:scale-95 shadow-md"
                >
                  Log In
                </button>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8">
        {view === 'home' && (
          <div className="max-w-4xl mx-auto px-6 h-full flex flex-col justify-center min-h-[calc(100vh-120px)] animate-fade-in">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center p-4 bg-chess-panel border border-chess-border rounded-2xl mb-6 shadow-2xl relative">
                <div className="absolute inset-0 bg-chess-accent blur-xl opacity-20 rounded-2xl"></div>
                <Swords size={48} className="text-chess-accent relative z-10" />
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-4">
                Mi<span className="text-chess-accent">chess</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
                Play against Stockfish, challenge friends via link, or analyze your games with powerful engine review.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full animate-slide-up">
              {/* Card 1: Bot */}
              <button 
                onClick={() => setSetupMode('computer')}
                className="bg-chess-panel border border-chess-border hover:border-chess-accent p-6 rounded-2xl flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.4)] group"
              >
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bot size={32} className="text-chess-accent" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Play vs Computer</h3>
                <p className="text-slate-400 text-sm">Challenge Stockfish bots from Beginner to Grandmaster.</p>
              </button>
              
              {/* Card 2: Link */}
              <button 
                onClick={() => setSetupMode('link')}
                className="bg-chess-panel border border-chess-border hover:border-chess-accent p-6 rounded-2xl flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.4)] group"
              >
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative overflow-hidden">
                  <div className="absolute inset-0 bg-chess-accent/20"></div>
                  <Link size={32} className="text-indigo-400 relative z-10" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Play a Friend</h3>
                <p className="text-slate-400 text-sm">Create a link and play multiplayer instantly, no login required.</p>
              </button>

              {/* Card 3: Local */}
              <button 
                onClick={() => setSetupMode('local')}
                className="bg-chess-panel border border-chess-border hover:border-chess-accent p-6 rounded-2xl flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.4)] group"
              >
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Swords size={32} className="text-slate-300 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Local Match</h3>
                <p className="text-slate-400 text-sm">Play a game with a friend on the same device.</p>
              </button>
            </div>
            
            <div className="flex justify-center mt-12 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
              <button 
                onClick={() => handleSetView('import')}
                className="px-6 py-3 bg-transparent border border-slate-700 hover:border-slate-500 hover:bg-slate-800 rounded-full font-bold text-slate-300 hover:text-white transition-all flex items-center gap-2 text-sm"
              >
                <Upload size={16} />
                Import Game / PGN
              </button>
            </div>
          </div>
        )}

        {view === 'play-computer' && computerConfig && (
          <ComputerPlayArea 
            difficulty={computerConfig.difficulty}
            playerColor={computerConfig.color}
            initialTimeMs={gameTimeControl ? gameTimeControl.minutes * 60 * 1000 : null}
            incrementMs={gameTimeControl ? gameTimeControl.increment * 1000 : 0}
            onExit={() => handleSetView('home')}
            onReview={startReview}
            onSaveGame={handleSaveGame}
          />
        )}

        {view === 'local' && (
          <PlayArea 
            onReview={startReview} 
            onSaveGame={handleSaveGame}
            initialTimeMs={gameTimeControl ? gameTimeControl.minutes * 60 * 1000 : null}
            incrementMs={gameTimeControl ? gameTimeControl.increment * 1000 : 0}
          />
        )}

        {view === 'import' && (
          <ImportGame 
            onCancel={() => handleSetView('home')} 
            onReview={startReview} 
          />
        )}

        {view === 'history' && (
          <HistoryList 
            history={history}
            onReview={startReview}
            onRemove={removeGame}
            onClear={clearHistory}
            onClose={() => handleSetView('home')}
          />
        )}

        {view === 'review' && reviewPgn && (
          <ReviewArea 
            pgn={reviewPgn} 
            onExit={() => setView(previousView === 'history' ? 'history' : 'home')} 
            onReviewComplete={handleReviewComplete}
          />
        )}

        {view === 'link-game' && linkInviteCode && (
          <LinkPlayArea 
            inviteCode={linkInviteCode} 
            onExit={() => handleSetView('home')} 
            onReview={startReview}
            onSaveGame={handleSaveGame}
            onRequireAuth={() => setShowAuth(true)}
          />
        )}

        {view === 'profile' && (
          <ProfileArea onExit={() => handleSetView('home')} />
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {needsMigration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-chess-panel border border-chess-border rounded-xl p-8 max-w-md w-full shadow-2xl text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Sync Local History</h2>
            <p className="text-slate-300 mb-6">
              You have games saved locally. Would you like to sync them to your new cloud account so you can access them across devices?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={skipMigration}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors border border-slate-600"
              >
                Keep Local Only
              </button>
              <button 
                onClick={migrateLocalGames}
                className="flex-1 py-3 bg-chess-accent hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors"
              >
                Sync Games
              </button>
            </div>
          </div>
        </div>
      )}
      
      {setupMode && (
        <GameSetupModal
          mode={setupMode}
          onClose={() => setSetupMode(null)}
          onStartComputer={(color, difficulty, tc) => {
            setSetupMode(null);
            startComputerGame(color, difficulty, tc);
          }}
          onStartLocal={(tc) => {
            setSetupMode(null);
            setGameTimeControl(tc);
            handleSetView('local');
          }}
          onStartLink={(color, tc) => {
            setSetupMode(null);
            handleCreateLinkGame(color, tc);
          }}
        />
      )}
    </div>
  );
}

export default App;
