import React, { useState } from 'react';
import { 
  Globe, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink, 
  Unlink, 
  Link as LinkIcon, 
  Clock, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useLinkedAccounts } from '../../hooks/useLinkedAccounts';
import { useHistory } from '../../hooks/useHistory';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface LinkedAccountsCardProps {
  onOpenIntelligence?: () => void;
  compact?: boolean;
}

export const LinkedAccountsCard: React.FC<LinkedAccountsCardProps> = ({ onOpenIntelligence, compact = false }) => {
  const { config, isSyncing, linkAccount, unlinkAccount, setAutoSync, syncGames } = useLinkedAccounts();
  const { history } = useHistory();

  const [chesscomInput, setChesscomInput] = useState('');
  const [lichessInput, setLichessInput] = useState('');
  const [linkingPlatform, setLinkingPlatform] = useState<'chesscom' | 'lichess' | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ platform: 'chesscom' | 'lichess'; message: string } | null>(null);

  // Stats
  const chesscomGamesCount = history.filter(g => g.source === 'chesscom').length;
  const lichessGamesCount = history.filter(g => g.source === 'lichess').length;

  const handleLink = async (platform: 'chesscom' | 'lichess') => {
    setErrorMsg(null);
    const username = platform === 'chesscom' ? chesscomInput : lichessInput;
    if (!username.trim()) return;

    setLinkingPlatform(platform);
    const result = await linkAccount(platform, username);
    setLinkingPlatform(null);

    if (result.success) {
      if (platform === 'chesscom') setChesscomInput('');
      else setLichessInput('');
    } else if (result.error) {
      setErrorMsg({ platform, message: result.error });
    }
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'Never';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-1">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="text-accent" size={20} />
            <h3 className="text-lg font-bold text-content-1">Linked Chess Accounts</h3>
          </div>
          <p className="text-xs text-content-3 mt-1">
            Connect your Chess.com or Lichess account to automatically import games for review and Game Intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => syncGames({ showToast: true })}
            disabled={isSyncing || (!config.chesscomUsername && !config.lichessUsername)}
            className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-accent' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Games'}</span>
          </Button>

          {onOpenIntelligence && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenIntelligence}
              className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Sparkles size={14} />
              <span>Analyze in Intelligence</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid of 2 Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Chess.com Card */}
        <div className={`p-4 rounded-xl border transition-all ${
          config.chesscomUsername 
            ? 'bg-emerald-950/20 border-emerald-800/40' 
            : 'bg-surface-1 border-border-1'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/30">
                ♟
              </div>
              <div>
                <h4 className="text-sm font-bold text-content-1 flex items-center gap-1.5">
                  <span>Chess.com</span>
                  {config.chesscomUsername && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={10} /> Linked
                    </span>
                  )}
                </h4>
                <span className="text-[11px] text-content-3">
                  {chesscomGamesCount} game{chesscomGamesCount !== 1 ? 's' : ''} imported
                </span>
              </div>
            </div>

            {config.chesscomUsername && (
              <a
                href={`https://www.chess.com/member/${config.chesscomUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-content-3 hover:text-emerald-400 transition-colors p-1"
                title="View Chess.com Profile"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {config.chesscomUsername ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs bg-surface-2/60 p-2.5 rounded-lg border border-border-1">
                <span className="text-content-3">Username:</span>
                <span className="font-mono font-bold text-content-1">@{config.chesscomUsername}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-content-3 px-1">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> Last synced: {formatLastSync(config.lastSyncChesscom)}
                </span>
                <button
                  onClick={() => unlinkAccount('chesscom')}
                  disabled={isSyncing}
                  className="text-red-400 hover:text-red-300 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Unlink size={11} /> Unlink
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Enter Chess.com username"
                    value={chesscomInput}
                    onChange={e => setChesscomInput(e.target.value)}
                    disabled={linkingPlatform === 'chesscom'}
                    onKeyDown={e => { if (e.key === 'Enter') handleLink('chesscom'); }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleLink('chesscom')}
                  disabled={linkingPlatform === 'chesscom' || !chesscomInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {linkingPlatform === 'chesscom' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <LinkIcon size={14} />
                  )}
                </Button>
              </div>

              {errorMsg?.platform === 'chesscom' && (
                <p className="text-xs text-red-400 flex items-center gap-1 animate-fade-in">
                  <AlertCircle size={12} /> {errorMsg.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2. Lichess Card */}
        <div className={`p-4 rounded-xl border transition-all ${
          config.lichessUsername 
            ? 'bg-indigo-950/20 border-indigo-800/40' 
            : 'bg-surface-1 border-border-1'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-black text-sm flex items-center justify-center border border-indigo-500/30">
                ♞
              </div>
              <div>
                <h4 className="text-sm font-bold text-content-1 flex items-center gap-1.5">
                  <span>Lichess</span>
                  {config.lichessUsername && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={10} /> Linked
                    </span>
                  )}
                </h4>
                <span className="text-[11px] text-content-3">
                  {lichessGamesCount} game{lichessGamesCount !== 1 ? 's' : ''} imported
                </span>
              </div>
            </div>

            {config.lichessUsername && (
              <a
                href={`https://lichess.org/@/${config.lichessUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-content-3 hover:text-indigo-400 transition-colors p-1"
                title="View Lichess Profile"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {config.lichessUsername ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs bg-surface-2/60 p-2.5 rounded-lg border border-border-1">
                <span className="text-content-3">Username:</span>
                <span className="font-mono font-bold text-content-1">@{config.lichessUsername}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-content-3 px-1">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> Last synced: {formatLastSync(config.lastSyncLichess)}
                </span>
                <button
                  onClick={() => unlinkAccount('lichess')}
                  disabled={isSyncing}
                  className="text-red-400 hover:text-red-300 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Unlink size={11} /> Unlink
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Enter Lichess username"
                    value={lichessInput}
                    onChange={e => setLichessInput(e.target.value)}
                    disabled={linkingPlatform === 'lichess'}
                    onKeyDown={e => { if (e.key === 'Enter') handleLink('lichess'); }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleLink('lichess')}
                  disabled={linkingPlatform === 'lichess' || !lichessInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  {linkingPlatform === 'lichess' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <LinkIcon size={14} />
                  )}
                </Button>
              </div>

              {errorMsg?.platform === 'lichess' && (
                <p className="text-xs text-red-400 flex items-center gap-1 animate-fade-in">
                  <AlertCircle size={12} /> {errorMsg.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sync Preferences & Auto-sync bar */}
      {!compact && (config.chesscomUsername || config.lichessUsername) && (
        <div className="pt-2 border-t border-border-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2.5 cursor-pointer text-content-2 hover:text-content-1 select-none">
            <input
              type="checkbox"
              checked={config.autoSync}
              onChange={e => setAutoSync(e.target.checked)}
              className="w-4 h-4 rounded text-accent focus:ring-accent bg-surface-1 border-border-1 cursor-pointer"
            />
            <span className="font-medium">
              Auto-sync matches automatically when you return to Michess
            </span>
          </label>

          <span className="text-[11px] text-content-3 font-mono flex items-center gap-1">
            <ShieldCheck size={13} className="text-accent" />
            Direct API sync • Zero password required
          </span>
        </div>
      )}
    </div>
  );
};
