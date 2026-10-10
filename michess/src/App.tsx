import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayArea } from './components/PlayArea';
import { GameSetupModal, type SetupMode, type TimeControl } from './components/GameSetupModal';
import { ComputerPlayArea } from './components/ComputerPlayArea';
import { ImportGame } from './components/ImportGame';
import type { Difficulty, PlayerColor } from './hooks/useComputerGame';
import { Swords, Bot, Settings as SettingsIcon, Upload, Clock, ChevronDown, Sparkles } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ReviewArea } from './components/ReviewArea';
import { useHistory } from './hooks/useHistory';
import { HistoryList } from './components/HistoryList';
import type { HistoryGame } from './types/history';
import { useAuth } from './hooks/useAuth';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { ProfileArea } from './components/ProfileArea';
import { LinkPlayArea } from './components/LinkPlayArea';
import { useProfile } from './hooks/useProfile';
import { useAchievementTracker } from './hooks/useAchievementTracker';
import { supabase } from './services/supabase';
import { generateUUID } from './utils/uuid';
import { Link, Users } from 'lucide-react';
import { useToast } from './components/Toast';
import { PublicProfile } from './components/PublicProfile';
import { SocialArea } from './components/SocialArea';
import { PuzzleArea } from './components/PuzzleArea';
import { Puzzle as PuzzleIcon, Info, LifeBuoy } from 'lucide-react';
import { SkillLevelModal } from './components/SkillLevelModal';
import { AboutArea } from './components/AboutArea';
import { SupportArea } from './components/SupportArea';
import { NotFoundArea } from './components/NotFoundArea';
import { NotificationDropdown } from './components/NotificationDropdown';
import { OpeningExplorerPage } from './components/OpeningExplorerPage';
import { useChallenges } from './hooks/useChallenges';
import { useDirectChat } from './hooks/useDirectChat';
import { FriendsChatModal } from './components/FriendsChatModal';
import { AdminArea } from './components/admin/AdminArea';
import { AccountRestrictionBanner } from './components/AccountRestrictionBanner';
import { BookOpen, MessageSquare, Shield } from 'lucide-react';
import heroImage from './assets/hero.png';

type ViewState = 'home' | 'local' | 'setup-computer' | 'play-computer' | 'review' | 'import' | 'history' | 'profile' | 'link-game' | 'social' | 'public-profile' | 'puzzles' | 'openings' | 'about' | 'support' | 'admin' | '404';

function App() {
  const [view, setView] = useState<ViewState>('home');
  const [previousView, setPreviousView] = useState<ViewState>('home');
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [computerConfig, setComputerConfig] = useState<{ color: PlayerColor, difficulty: Difficulty } | null>(null);
  const [gameTimeControl, setGameTimeControl] = useState<TimeControl | null>(null);
  const [reviewPgn, setReviewPgn] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [linkInviteCode, setLinkInviteCode] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const [challengeTargetId, setChallengeTargetId] = useState<string | null>(null);
  const [skillModalDismissed, setSkillModalDismissed] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showFriendsChat, setShowFriendsChat] = useState(false);
  const [chatActiveFriendId, setChatActiveFriendId] = useState<string | null>(null);
  const { totalUnreadCount } = useDirectChat();
  const { addToast } = useToast();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const { sendChallenge, respondToChallenge } = useChallenges();
  useAchievementTracker();

  // Close nav menu on click outside
  useEffect(() => {
    const handleMenuClickOutside = (e: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setShowNavMenu(false);
      }
    };
    if (showNavMenu) {
      document.addEventListener('mousedown', handleMenuClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleMenuClickOutside);
  }, [showNavMenu]);

  const { user, loading: authLoading } = useAuth();
  const { history, addGame, removeGame, clearHistory, updateGameReviewStats, migrateLocalGames, skipMigration, needsMigration } = useHistory();

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const linkMatch = path.match(/^\/play\/link\/([a-zA-Z0-9_-]+)$/);
      const playerMatch = path.match(/^\/player\/([a-zA-Z0-9_-]+)$/);
      
      if (linkMatch) {
        setLinkInviteCode(linkMatch[1]);
        setView('link-game');
      } else if (playerMatch) {
        setTargetUsername(playerMatch[1]);
        setView('public-profile');
      } else if (path === '/puzzles') {
        setView('puzzles');
      } else if (path === '/openings') {
        setView('openings');
      } else if (path === '/history') {
        setView('history');
      } else if (path === '/computer' || path === '/play-computer') {
        setSetupMode('computer');
        setView('home');
      } else if (path === '/local' || path === '/play-local') {
        setSetupMode('local');
        setView('home');
      } else if (path === '/social') {
        setView('social');
      } else if (path === '/import') {
        setView('import');
      } else if (path === '/about') {
        setView('about');
      } else if (path === '/support') {
        setView('support');
      } else if (path === '/profile') {
        setView('profile');
      } else if (path === '/admin') {
        setView('admin');
      } else if (path !== '/' && path !== '') {
        setView('404');
      } else {
        setView('home');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);

    let subscription: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, _session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowResetPassword(true);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Force users to set a username if they just signed up — but ONLY once auth has fully resolved
  useEffect(() => {
    if (!authLoading && user && !profileLoading && !profile && view !== 'profile') {
      setView('profile');
      window.history.pushState({}, '', '/profile');
    }
  }, [authLoading, user, profile, profileLoading, view]);

  const handleSetView = (v: ViewState) => {
    if (!authLoading && user && !profileLoading && !profile && v !== 'profile') {
      addToast('Please set a username first!', 'info');
      setView('profile');
      window.history.pushState({}, '', '/profile');
      return;
    }

    if (v === 'home') {
      window.history.pushState({}, '', '/');
    } else if (v === 'puzzles') {
      window.history.pushState({}, '', '/puzzles');
    } else if (v === 'openings') {
      window.history.pushState({}, '', '/openings');
    } else if (v === 'history') {
      window.history.pushState({}, '', '/history');
    } else if (v === 'social') {
      window.history.pushState({}, '', '/social');
    } else if (v === 'import') {
      window.history.pushState({}, '', '/import');
    } else if (v === 'local') {
      window.history.pushState({}, '', '/local');
    } else if (v === 'play-computer') {
      window.history.pushState({}, '', '/computer');
    } else if (v === 'about') {
      window.history.pushState({}, '', '/about');
    } else if (v === 'support') {
      window.history.pushState({}, '', '/support');
    } else if (v === 'profile') {
      window.history.pushState({}, '', '/profile');
    } else if (v === 'admin') {
      window.history.pushState({}, '', '/admin');
    }
    setView(v);
  };

  const handleCreateLinkGame = async (preferredColor: PlayerColor, timeControl: TimeControl | null = null) => {
    if (profile?.is_banned || (profile?.suspended_until && new Date(profile.suspended_until) > new Date())) {
      addToast("Your account is currently restricted from creating online games.", "error");
      return;
    }

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

  const handleViewProfile = (username: string) => {
    setTargetUsername(username);
    setPreviousView(view);
    setView('public-profile');
    window.history.pushState({}, '', `/player/${username}`);
  };

  const handleReviewComplete = useCallback((pgn: string, stats: any) => {
    updateGameReviewStats(pgn, stats);
  }, [updateGameReviewStats]);

  const handleSaveGame = (pgn: string, white: string, black: string, result: string, date: string, event: string) => {
    const isComputer = view === 'play-computer';
    addGame({
      pgn,
      white,
      black,
      result,
      date,
      event,
      source: isComputer ? 'computer' : 'local',
      moveCount: pgn.split('. ').length - 1
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className={`${view === '404' ? 'bg-black border-b border-red-900/30 text-red-500/80 transition-colors duration-1000' : 'bg-surface-2 border-b border-border-1'} px-4 md:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6 relative z-50`}>
        {/* Logo */}
        <h1 
          className={`text-xl sm:text-2xl font-bold tracking-wider cursor-pointer flex items-center gap-2 active:scale-95 transition-transform shrink-0 ${view === '404' ? 'text-red-700/80 drop-shadow-[0_0_8px_rgba(255,0,0,0.3)]' : 'text-content-1'}`}
          onClick={() => handleSetView('home')}
        >
          <Swords className={view === '404' ? 'text-red-700 animate-pulse' : 'text-accent'} size={24} />
          <span>Mi<span className={view === '404' ? 'text-red-900' : 'text-accent'}>chess</span></span>
        </h1>

        {/* Middle Spacer */}
        <div className="flex-1"></div>

        {/* User Utilities & Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Navigation Dropdown (Upside down "^" / ChevronDown) */}
          <div className="relative" ref={navMenuRef}>
            <button
              onClick={() => setShowNavMenu(prev => !prev)}
              className={`p-2 rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer border ${
                view === '404'
                  ? (showNavMenu
                      ? 'bg-red-950/60 border-red-700 text-red-500 shadow-[0_0_12px_rgba(255,0,0,0.4)]'
                      : 'bg-black/60 hover:bg-red-950/30 border-red-900/40 text-red-700 hover:text-red-500')
                  : (showNavMenu 
                      ? 'bg-accent/15 border-accent text-accent shadow-sm' 
                      : 'bg-surface-3/80 hover:bg-surface-3 border-border-1 text-content-2 hover:text-content-1')
              }`}
              title="Explore & Play Modes"
              aria-label="Navigation Menu"
              aria-expanded={showNavMenu}
            >
              <ChevronDown 
                size={18} 
                className={`transition-transform duration-200 ${
                  showNavMenu 
                    ? (view === '404' ? 'rotate-180 text-red-500' : 'rotate-180 text-accent') 
                    : (view === '404' ? 'text-red-700' : '')
                }`} 
              />
            </button>

            {/* Dropdown Menu */}
            {showNavMenu && (
              <div className={`absolute right-0 top-full mt-2 w-56 border rounded-xl shadow-2xl overflow-hidden py-1.5 z-50 animate-scale-in ${
                view === '404'
                  ? 'bg-black/95 border-red-900/60 shadow-[0_0_25px_rgba(255,0,0,0.2)] text-red-200'
                  : 'bg-surface-2 border-border-1'
              }`}>
                <div className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5 ${
                  view === '404' ? 'border-red-900/40 text-red-500' : 'text-content-3 border-border-1/50'
                }`}>
                  <Sparkles size={12} className={view === '404' ? 'text-red-600' : 'text-accent'} />
                  <span>Navigate</span>
                </div>

                <div className="p-1 space-y-0.5">
                  <a
                    href="/puzzles"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSetView('puzzles');
                      setShowNavMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      view === '404'
                        ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                        : (view === 'puzzles'
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-content-2 hover:text-content-1 hover:bg-surface-3')
                    }`}
                  >
                    <PuzzleIcon size={16} className={view === '404' ? 'text-red-500' : (view === 'puzzles' ? 'text-accent' : 'text-content-3')} />
                    <span>Puzzles</span>
                  </a>

                  <a
                    href="/openings"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSetView('openings');
                      setShowNavMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      view === '404'
                        ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                        : (view === 'openings'
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-content-2 hover:text-content-1 hover:bg-surface-3')
                    }`}
                  >
                    <BookOpen size={16} className={view === '404' ? 'text-red-500' : (view === 'openings' ? 'text-accent' : 'text-content-3')} />
                    <span>Openings</span>
                  </a>

                  <a
                    href="/history"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSetView('history');
                      setShowNavMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      view === '404'
                        ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                        : (view === 'history'
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-content-2 hover:text-content-1 hover:bg-surface-3')
                    }`}
                  >
                    <Clock size={16} className={view === '404' ? 'text-red-500' : (view === 'history' ? 'text-accent' : 'text-content-3')} />
                    <span>History</span>
                  </a>

                  <div className={`h-px my-1 ${view === '404' ? 'bg-red-900/40' : 'bg-border-1/50'}`}></div>

                  <a
                    href="/computer"
                    onClick={(e) => {
                      e.preventDefault();
                      setSetupMode('computer');
                      setShowNavMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      view === '404'
                        ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                        : (view === 'play-computer'
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-content-2 hover:text-content-1 hover:bg-surface-3')
                    }`}
                  >
                    <Bot size={16} className={view === '404' ? 'text-red-500' : (view === 'play-computer' ? 'text-accent' : 'text-content-3')} />
                    <span>Play vs Computer</span>
                  </a>

                  <a
                    href="/local"
                    onClick={(e) => {
                      e.preventDefault();
                      setSetupMode('local');
                      setShowNavMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      view === '404'
                        ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                        : (view === 'local'
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-content-2 hover:text-content-1 hover:bg-surface-3')
                    }`}
                  >
                    <Swords size={16} className={view === '404' ? 'text-red-500' : (view === 'local' ? 'text-accent' : 'text-content-3')} />
                    <span>Local Play</span>
                  </a>

                  <a
                    href="/social"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSetView('social');
                      setShowNavMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      view === '404'
                        ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                        : (view === 'social'
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-content-2 hover:text-content-1 hover:bg-surface-3')
                    }`}
                  >
                    <Users size={16} className={view === '404' ? 'text-red-500' : (view === 'social' ? 'text-accent' : 'text-content-3')} />
                    <span>Social & Friends</span>
                  </a>

                  {profile?.username?.toLowerCase() === 'mikzqc' && (
                    <>
                      <div className={`h-px my-1 ${view === '404' ? 'bg-red-900/40' : 'bg-border-1/50'}`}></div>
                      <a
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSetView('admin');
                          setShowNavMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                          view === '404'
                            ? 'text-red-400 hover:text-red-200 hover:bg-red-950/40'
                            : (view === 'admin'
                                ? 'bg-accent/15 text-accent font-semibold'
                                : 'text-accent hover:text-accent-hover hover:bg-accent/10')
                        }`}
                      >
                        <Shield size={16} className="text-accent" />
                        <span className="flex-1 font-bold">Admin Panel</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                          mikzqc
                        </span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings Button */}
          <button 
            onClick={() => setShowSettings(true)}
            className={`${view === '404' ? 'text-red-900 hover:text-red-500 hover:bg-red-950/30' : 'text-content-3 hover:text-content-1 hover:bg-surface-3'} p-2 rounded-lg transition-colors flex items-center justify-center active:scale-95 cursor-pointer`}
            title="Settings"
            aria-label="Open Settings"
          >
            <SettingsIcon size={18} />
          </button>

          <div className={`h-5 w-px hidden sm:block ${view === '404' ? 'bg-red-900/30' : 'bg-border-1'}`}></div>

          {!authLoading && (
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <NotificationDropdown 
                    isNotFound={view === '404'}
                    onViewProfile={handleViewProfile} 
                    onJoinGame={(gameId) => {
                      setLinkInviteCode(gameId);
                      handleSetView('link-game');
                    }}
                    onAcceptChallenge={async (challenge) => {
                      if (!supabase || !user) return;
                      // Generate invite code and randomize colors
                      const inviteCode = Math.random().toString(36).substring(2, 9);
                      const isWhite = Math.random() > 0.5;
                      
                      let tcStr: string | null = null;
                      let initialMs: number | null = null;
                      let incMs = 0;
                      if (challenge.time_control && challenge.time_control !== 'untimed') {
                        const [min, inc] = challenge.time_control.split('+').map(Number);
                        if (!isNaN(min)) {
                          tcStr = challenge.time_control;
                          initialMs = min * 60 * 1000;
                          incMs = (inc || 0) * 1000;
                        }
                      }

                      const whitePlayer = isWhite ? user.id : challenge.sender_id;
                      const blackPlayer = isWhite ? challenge.sender_id : user.id;

                      let created = false;

                      // 1. Try create_challenge_game RPC
                      try {
                        const { data: rpcGame, error: rpcErr } = await supabase.rpc('create_challenge_game', {
                          p_invite_code: inviteCode,
                          p_white_player: whitePlayer,
                          p_black_player: blackPlayer,
                          p_time_control: tcStr,
                          p_initial_time_ms: initialMs,
                          p_increment_ms: incMs
                        });
                        if (!rpcErr && rpcGame) {
                          created = true;
                        }
                      } catch {}

                      // 2. Fallback: try standard create_link_game RPC
                      if (!created) {
                        try {
                          const { error: linkErr } = await supabase.rpc('create_link_game', {
                            p_invite_code: inviteCode,
                            p_creator_id: user.id,
                            p_is_white: isWhite,
                            p_time_control: tcStr,
                            p_initial_time_ms: initialMs,
                            p_increment_ms: incMs
                          });
                          if (!linkErr) {
                            created = true;
                          }
                        } catch {}
                      }

                      // 3. Fallback: direct table insert with correct schema
                      if (!created) {
                        try {
                          const { error: insErr } = await supabase.from('link_games').insert({
                            invite_code: inviteCode,
                            white_player: whitePlayer,
                            black_player: blackPlayer,
                            status: 'active',
                            time_control: tcStr,
                            initial_time_ms: initialMs,
                            increment_ms: incMs,
                            white_time_ms: initialMs,
                            black_time_ms: initialMs
                          });
                          if (!insErr) {
                            created = true;
                          }
                        } catch {}
                      }

                      if (!created) {
                        addToast('Failed to create challenge game', 'error');
                        return;
                      }

                      const res = await respondToChallenge(challenge.id, true, inviteCode);
                      if (res.success) {
                        setLinkInviteCode(inviteCode);
                        handleSetView('link-game');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFriendsChat(true)}
                    className={`relative p-2 rounded-lg transition-colors active:scale-95 cursor-pointer ${
                      view === '404'
                        ? 'text-red-900 hover:text-red-500 hover:bg-red-950/30'
                        : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
                    }`}
                    aria-label="Friends Chat"
                    title="Friends Chat"
                  >
                    <MessageSquare size={18} />
                    {totalUnreadCount > 0 && (
                      <span className={`absolute top-1 right-1 w-4 h-4 text-white text-[10px] font-bold flex items-center justify-center rounded-full pointer-events-none ${
                        view === '404' ? 'bg-red-700 animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.6)]' : 'bg-accent'
                      }`}>
                        {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => handleSetView('profile')}
                    className={`px-3 py-1.5 rounded-lg border transition-colors font-medium text-sm active:scale-95 flex items-center justify-center min-h-[34px] cursor-pointer ${view === '404' ? 'bg-red-950/20 border-red-900/30 text-red-700 hover:text-red-500 hover:bg-red-900/40' : (view === 'profile' ? 'bg-accent border-accent text-white font-semibold' : 'bg-surface-3 border-border-1 hover:bg-surface-2 text-content-1')}`}
                  >
                  {profileLoading ? (
                    <div className="w-12 h-3 animate-pulse bg-content-3/30 rounded-full" />
                  ) : (
                    <div className="flex items-center gap-2">
                      {profile?.avatar_url && (
                        <img 
                          src={profile.avatar_url} 
                          alt="Avatar" 
                          className="w-5 h-5 rounded-full object-cover shrink-0" 
                        />
                      )}
                      <span className="truncate max-w-[110px]">{profile?.username || 'Profile'}</span>
                    </div>
                  )}
                </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowAuth(true)}
                  className="bg-accent hover:bg-accent-hover px-4 py-1.5 rounded-lg transition-colors font-semibold text-sm text-white active:scale-95 shadow-sm cursor-pointer"
                >
                  Log In
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Moderation Restriction Notice */}
      <AccountRestrictionBanner profile={profile} onOpenSupport={() => handleSetView('support')} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <div className="max-w-6xl mx-auto px-6 py-12 lg:py-24 flex flex-col justify-center min-h-full animate-fade-in relative">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-accent/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 mb-16">
              <div className="flex-1 text-center lg:text-left z-10">
                <div className="inline-flex items-center justify-center p-3 glass-panel rounded-2xl mb-6 text-accent animate-slide-up shadow-xl shadow-accent/10 border-accent/20">
                  <Swords size={32} />
                </div>
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-tight animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                  Next-Gen <br className="hidden lg:block"/>
                  <span className="text-gradient">Chess</span>
                </h2>
                <p className="text-content-2 text-lg md:text-xl max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed mb-8 animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                  Experience the ultimate chess platform. Play Stockfish, challenge friends instantly, and master your skills with pro-level engine analysis.
                </p>
                <div className="flex flex-wrap justify-center lg:justify-start gap-4 animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                  <button 
                    onClick={() => setSetupMode('computer')}
                    className="px-8 py-4 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all flex items-center gap-3 active:scale-95"
                  >
                    <Bot size={24} /> Play Stockfish
                  </button>
                  <button 
                    onClick={() => setSetupMode('link')}
                    className="px-8 py-4 glass-panel hover:bg-surface-3 text-content-1 rounded-xl font-bold text-lg transition-all flex items-center gap-3 active:scale-95"
                  >
                    <Link size={24} /> Play a Friend
                  </button>
                </div>
              </div>
              
              <div className="flex-1 w-full max-w-md lg:max-w-none animate-slide-in-right relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-info/20 rounded-3xl blur-3xl -z-10 transform rotate-6 scale-105"></div>
                <img 
                  src={heroImage} 
                  alt="Chess Board" 
                  className="w-full h-auto drop-shadow-2xl rounded-3xl"
                  onError={(e) => { e.currentTarget.src = '/hero.png' }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
              <button 
                onClick={() => setSetupMode('computer')}
                className="glass-panel p-6 rounded-2xl flex flex-col items-start text-left transition-all hover:-translate-y-2 hover:shadow-xl hover:border-accent/50 group cursor-pointer"
              >
                <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-accent">
                  <Bot size={24} />
                </div>
                <h3 className="text-xl font-bold text-content-1 mb-2">Vs Computer</h3>
                <p className="text-content-3 text-sm">Challenge Stockfish bots from Beginner to GM.</p>
              </button>
              
              <button 
                onClick={() => setSetupMode('link')}
                className="glass-panel p-6 rounded-2xl flex flex-col items-start text-left transition-all hover:-translate-y-2 hover:shadow-xl hover:border-info/50 group cursor-pointer"
              >
                <div className="w-12 h-12 bg-info/10 border border-info/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-info">
                  <Link size={24} />
                </div>
                <h3 className="text-xl font-bold text-content-1 mb-2">Play Online</h3>
                <p className="text-content-3 text-sm">Share a link and play multiplayer instantly.</p>
              </button>

              <button 
                onClick={() => handleSetView('puzzles')}
                className="glass-panel p-6 rounded-2xl flex flex-col items-start text-left transition-all hover:-translate-y-2 hover:shadow-xl hover:border-warning/50 group cursor-pointer"
              >
                <div className="w-12 h-12 bg-warning/10 border border-warning/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-warning">
                  <PuzzleIcon size={24} />
                </div>
                <h3 className="text-xl font-bold text-content-1 mb-2">Free Puzzles</h3>
                <p className="text-content-3 text-sm">Improve tactics with unlimited puzzles.</p>
              </button>

              <button 
                onClick={() => handleSetView('import')}
                className="glass-panel p-6 rounded-2xl flex flex-col items-start text-left transition-all hover:-translate-y-2 hover:shadow-xl hover:border-success/50 group cursor-pointer"
              >
                <div className="w-12 h-12 bg-success/10 border border-success/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-success">
                  <Upload size={24} />
                </div>
                <h3 className="text-xl font-bold text-content-1 mb-2">Review Game</h3>
                <p className="text-content-3 text-sm">Analyze your PGNs with powerful engine review.</p>
              </button>
            </div>

            {/* Footer links */}
            <div className="mt-16 pt-6 border-t border-border-1/50 flex flex-wrap items-center justify-center gap-6 text-sm animate-slide-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
              <button
                onClick={() => handleSetView('about')}
                className="text-content-3 hover:text-accent transition-colors flex items-center gap-1.5"
              >
                <Info size={14} /> About Michess
              </button>
              <span className="text-border-1">•</span>
              <button
                onClick={() => handleSetView('support')}
                className="text-content-3 hover:text-accent transition-colors flex items-center gap-1.5"
              >
                <LifeBuoy size={14} /> Support & Contact
              </button>
              <span className="text-border-1">•</span>
              <span className="text-content-3/50">© {new Date().getFullYear()} Michess</span>
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
            onViewProfile={handleViewProfile}
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
          <ProfileArea 
            onExit={() => handleSetView('home')} 
            onViewProfile={handleViewProfile}
            onProfileUpdate={refreshProfile}
            onRequireAuth={() => setShowAuth(true)}
          />
        )}

        {view === 'public-profile' && targetUsername && (
          <PublicProfile 
            username={targetUsername} 
            onExit={() => {
              setView(previousView);
              setTargetUsername(null);
              
              if (previousView === 'home') {
                window.history.pushState({}, '', '/');
              } else if (previousView === 'puzzles') {
                window.history.pushState({}, '', '/puzzles');
              } else if (previousView === 'profile') {
                window.history.pushState({}, '', '/profile');
              } else {
                window.history.pushState({}, '', '/');
              }
            }} 
            onChallenge={(userId) => {
              setChallengeTargetId(userId);
              setSetupMode('challenge');
            }} 
            onOpenChat={(userId) => {
              setChatActiveFriendId(userId);
              setShowFriendsChat(true);
            }}
          />
        )}
        {view === 'social' && (
          <SocialArea 
            onExit={() => handleSetView('home')} 
            onViewProfile={handleViewProfile} 
            onOpenChat={(friendId) => {
              setChatActiveFriendId(friendId);
              setShowFriendsChat(true);
            }}
          />
        )}
        {view === 'puzzles' && (
          <PuzzleArea 
            onExit={() => handleSetView('home')} 
          />
        )}
        {view === 'openings' && (
          <OpeningExplorerPage 
            onExit={() => handleSetView('home')} 
          />
        )}
        {view === 'about' && (
          <AboutArea onExit={() => handleSetView('home')} />
        )}
        {view === 'support' && (
          <SupportArea onExit={() => handleSetView('home')} />
        )}
        {view === 'admin' && (
          <AdminArea onBack={() => handleSetView('home')} onViewProfile={handleViewProfile} />
        )}
        {view === '404' && (
          <NotFoundArea onExit={() => handleSetView('home')} />
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showResetPassword && <ResetPasswordModal onClose={() => setShowResetPassword(false)} />}
      {user && profile && (!profile.games_played || profile.games_played === 0) && (!profile.highest_rating && !profile.rating_bullet && !profile.rating_blitz) && !localStorage.getItem('skill_modal_' + user.id) && !skillModalDismissed && (
        <SkillLevelModal 
          onClose={() => {
            localStorage.setItem('skill_modal_' + user.id, 'true');
            setSkillModalDismissed(true);
          }}
          onComplete={async () => {
            localStorage.setItem('skill_modal_' + user.id, 'true');
            setSkillModalDismissed(true);
            await refreshProfile();
          }} 
        />
      )}

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
          onClose={() => {
            setSetupMode(null);
            setChallengeTargetId(null);
          }}
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
          onStartChallenge={async (tc) => {
            setSetupMode(null);
            if (challengeTargetId) {
              const tcString = tc ? `${tc.minutes}+${tc.increment}` : 'untimed';
              const result = await sendChallenge(challengeTargetId, tcString);
              if (result.success) {
                addToast('Challenge sent!', 'success');
              } else {
                addToast(`Failed to send challenge: ${result.error}`, 'error');
              }
            }
            setChallengeTargetId(null);
          }}
        />
      )}

      {/* Friends Chat Modal */}
      <FriendsChatModal
        isOpen={showFriendsChat}
        onClose={() => {
          setShowFriendsChat(false);
          setChatActiveFriendId(null);
        }}
        initialFriendId={chatActiveFriendId}
        onChallengeFriend={(friendId) => {
          setShowFriendsChat(false);
          setChallengeTargetId(friendId);
          setSetupMode('challenge');
        }}
        onViewProfile={handleViewProfile}
      />
    </div>
  );
}

export default App;
