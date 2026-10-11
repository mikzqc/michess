import React, { useState } from 'react';
import { 
  Brain, 
  Layers, 
  AlertTriangle, 
  Target, 
  FileText, 
  Sparkles, 
  ArrowLeft,
  Globe,
  RefreshCw
} from 'lucide-react';
import { useGameIntelligence } from '../../hooks/useGameIntelligence';
import { useLinkedAccounts } from '../../hooks/useLinkedAccounts';
import { IntelligenceDashboard } from './IntelligenceDashboard';
import { WeaknessReportView } from './WeaknessReportView';
import { RecurringMistakesView } from './RecurringMistakesView';
import { TrainingRecommendationsView } from './TrainingRecommendationsView';
import { AnalyzedGamesView } from './AnalyzedGamesView';
import { InsufficientDataCard } from './InsufficientDataCard';
import { BatchAnalysisProgress } from './BatchAnalysisProgress';
import { MistakeTrainerModal } from './MistakeTrainerModal';
import { LinkedAccountsModal } from '../linkedAccounts/LinkedAccountsModal';
import type { DetectedMistake } from '../../types/intelligence';
import { Button } from '../ui/Button';

interface GameIntelligencePageProps {
  onExit: () => void;
  onOpenReview: (pgn: string) => void;
  onOpenPuzzles: () => void;
  onOpenOpenings: (eco?: string) => void;
  onPlayGame: () => void;
  onImportGame: () => void;
}

type IntelligenceTab = 'dashboard' | 'weaknesses' | 'mistakes' | 'training' | 'games';

export const GameIntelligencePage: React.FC<GameIntelligencePageProps> = ({
  onExit,
  onOpenReview,
  onOpenPuzzles,
  onOpenOpenings,
  onPlayGame,
  onImportGame
}) => {
  const {
    history,
    analyses,
    summary,
    colorFilter,
    setColorFilter,
    isAnalyzingBatch,
    batchProgress,
    startBatchAnalysis,
    cancelBatchAnalysis,
    analyzeGame,
    unanalyzedCount,
    isInsufficientData
  } = useGameIntelligence();

  const { config: linkedConfig, isSyncing: isSyncingLinked, syncGames: syncLinkedGames } = useLinkedAccounts();
  const [showLinkedModal, setShowLinkedModal] = useState(false);
  const [activeTab, setActiveTab] = useState<IntelligenceTab>('dashboard');
  const [activeMistakeToTrain, setActiveMistakeToTrain] = useState<DetectedMistake | null>(null);
  const [batchSize, setBatchSize] = useState<number>(10);

  const isAccountsLinked = !!(linkedConfig.chesscomUsername || linkedConfig.lichessUsername);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 max-w-7xl mx-auto w-full space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-1 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
            title="Return to Home"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-content-1 flex items-center gap-2.5 tracking-tight">
              <Brain size={26} className="text-accent" />
              <span>Game Intelligence</span>
            </h1>
            <p className="text-xs text-content-3">
              Deep game analysis, weakness diagnosis, and targeted mistake training powered by Stockfish.
            </p>
          </div>
        </div>

        {/* Action Controls: Batch Analysis, Account Sync & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Linked accounts sync button */}
          {isAccountsLinked ? (
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => syncLinkedGames({ showToast: true })}
                disabled={isSyncingLinked}
                className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Sync recent matches from Chess.com and Lichess"
              >
                <RefreshCw size={13} className={isSyncingLinked ? 'animate-spin text-accent' : ''} />
                <span>{isSyncingLinked ? 'Syncing...' : 'Sync Matches'}</span>
              </Button>
              <button
                onClick={() => setShowLinkedModal(true)}
                className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-1 text-content-3 hover:text-content-1 transition-colors cursor-pointer"
                title="Manage Linked Accounts"
              >
                <Globe size={15} />
              </button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLinkedModal(true)}
              className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Globe size={14} className="text-accent" />
              <span>Link Accounts</span>
            </Button>
          )}

          {/* Color filter */}
          <div className="flex items-center bg-surface-2 border border-border-1 rounded-xl p-1 text-xs">
            {(['all', 'white', 'black'] as const).map(c => (
              <button
                key={c}
                onClick={() => setColorFilter(c)}
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors capitalize ${
                  colorFilter === c
                    ? 'bg-accent text-white font-bold'
                    : 'text-content-3 hover:text-content-1'
                }`}
              >
                {c === 'all' ? 'All Colors' : c}
              </button>
            ))}
          </div>

          {/* Analyze Unanalyzed Games Button */}
          {unanalyzedCount > 0 && (
            <div className="flex items-center bg-surface-2 border border-border-1 rounded-xl p-0.5">
              <Button
                variant="primary"
                size="sm"
                onClick={() => startBatchAnalysis(batchSize)}
                disabled={isAnalyzingBatch}
                className="text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 rounded-lg"
                title={`Analyze up to ${batchSize} games at once with Stockfish`}
              >
                <Sparkles size={14} />
                <span>
                  {isAnalyzingBatch
                    ? 'Analyzing...'
                    : `Analyze ${Math.min(batchSize, unanalyzedCount)} Games`}
                </span>
              </Button>
              {unanalyzedCount > 5 && (
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  disabled={isAnalyzingBatch}
                  className="bg-transparent text-xs font-bold text-content-2 hover:text-content-1 px-2 py-1 outline-none cursor-pointer border-l border-border-1 ml-0.5"
                  title="Choose number of games to analyze at once"
                >
                  <option value={5} className="bg-surface-2 text-content-1">5 at once</option>
                  <option value={10} className="bg-surface-2 text-content-1">10 at once</option>
                  {unanalyzedCount >= 20 && (
                    <option value={20} className="bg-surface-2 text-content-1">20 at once</option>
                  )}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Batch Analysis Banner */}
      {isAnalyzingBatch && batchProgress && (
        <BatchAnalysisProgress
          progress={batchProgress}
          onCancel={cancelBatchAnalysis}
        />
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border-1/60 scrollbar-none">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <Layers size={15} /> },
          { id: 'weaknesses', label: 'Weakness Report', icon: <Target size={15} />, badge: summary.weaknesses.length },
          { id: 'mistakes', label: 'Recurring Mistakes', icon: <AlertTriangle size={15} />, badge: summary.recurringMistakes.length },
          { id: 'training', label: 'Recommended Training', icon: <Sparkles size={15} />, badge: summary.recommendations.length },
          { id: 'games', label: 'Analyzed Games', icon: <FileText size={15} />, badge: analyses.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as IntelligenceTab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
              activeTab === tab.id
                ? 'bg-accent/15 border-accent text-accent shadow-sm'
                : 'bg-surface-2 border-border-1 text-content-3 hover:text-content-1 hover:bg-surface-3'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === tab.id ? 'bg-accent text-white' : 'bg-surface-3 text-content-2'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 4. Tab Content */}
      {isInsufficientData && activeTab === 'dashboard' ? (
        <InsufficientDataCard
          analyzedCount={analyses.length}
          totalGames={history.length}
          onStartAnalysis={() => startBatchAnalysis(batchSize)}
          onPlayGame={onPlayGame}
          onImportGame={onImportGame}
        />
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <IntelligenceDashboard
              summary={summary}
              onExploreOpening={onOpenOpenings}
            />
          )}

          {activeTab === 'weaknesses' && (
            <WeaknessReportView
              reports={summary.weaknesses}
              onPracticeMistake={setActiveMistakeToTrain}
            />
          )}

          {activeTab === 'mistakes' && (
            <RecurringMistakesView
              mistakes={summary.recurringMistakes}
              blunderedPieces={summary.blunderedPieces}
              onPracticeMistake={setActiveMistakeToTrain}
            />
          )}

          {activeTab === 'training' && (
            <TrainingRecommendationsView
              recommendations={summary.recommendations}
              onLaunchPositionRetry={setActiveMistakeToTrain}
              onLaunchPuzzles={onOpenPuzzles}
              onLaunchOpenings={onOpenOpenings}
            />
          )}

          {activeTab === 'games' && (
            <AnalyzedGamesView
              analyses={analyses}
              allHistoryGames={history}
              onOpenReview={onOpenReview}
              onAnalyzeGame={(g) => analyzeGame(g)}
              isAnalyzingBatch={isAnalyzingBatch}
              onOpenLinkedAccounts={() => setShowLinkedModal(true)}
            />
          )}
        </>
      )}

      {/* 5. Mistake Trainer Interactive Modal */}
      {activeMistakeToTrain && (
        <MistakeTrainerModal
          mistake={activeMistakeToTrain}
          mistakesList={summary.recurringMistakes}
          onClose={() => setActiveMistakeToTrain(null)}
          onSelectMistake={setActiveMistakeToTrain}
        />
      )}

      {/* 6. Linked Accounts Modal */}
      {showLinkedModal && (
        <LinkedAccountsModal
          onClose={() => setShowLinkedModal(false)}
        />
      )}
    </div>
  );
};
