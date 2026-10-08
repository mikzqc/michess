import React from 'react';
import { ArrowLeft, Swords, Code, Globe, Star, ShieldCheck, Heart } from 'lucide-react';
import { Button } from './ui/Button';

interface AboutAreaProps {
  onExit: () => void;
}

export const AboutArea: React.FC<AboutAreaProps> = ({ onExit }) => {
  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 h-full flex flex-col py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onExit} className="pl-0 hover:bg-transparent">
          <ArrowLeft size={20} className="mr-2" /> Back
        </Button>
        <h2 className="text-2xl font-black text-content-1">About Michess</h2>
        <div className="w-20"></div> {/* Spacer */}
      </div>

      <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-8 relative overflow-hidden shadow-sm animate-slide-up flex-1">
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-br from-accent/10 via-surface-2/0 to-surface-2/0 z-0 pointer-events-none"></div>

        <div className="relative z-10 space-y-12">
          
          <div className="text-center space-y-4 pt-6">
            <div className="inline-flex items-center justify-center p-4 bg-surface-3 rounded-3xl mb-2 text-accent shadow-xl shadow-accent/5 border border-accent/20 ring-4 ring-surface-1">
              <Swords size={48} />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-content-1">
              Welcome to <span className="text-accent">Michess</span>
            </h1>
            <p className="text-lg text-content-2 max-w-2xl mx-auto leading-relaxed">
              Michess is a modern, blazing-fast chess platform designed for players who want a beautiful, distraction-free environment to learn, play, and master the game.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="bg-surface-2 p-6 rounded-2xl border border-border-1 hover:border-accent/30 transition-colors">
              <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center mb-4">
                <Star size={24} />
              </div>
              <h3 className="text-xl font-bold text-content-1 mb-2">Pro Analysis</h3>
              <p className="text-content-3 leading-relaxed">
                Analyze your games instantly with Stockfish WebAssembly. Get brilliant moves, inaccuracies, and full evaluation graphs in your browser.
              </p>
            </div>

            <div className="bg-surface-2 p-6 rounded-2xl border border-border-1 hover:border-success/30 transition-colors">
              <div className="w-12 h-12 bg-success/10 text-success rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-content-1 mb-2">Secure & Private</h3>
              <p className="text-content-3 leading-relaxed">
                Powered by enterprise-grade Supabase authentication. Your data, ratings, and match history belong to you.
              </p>
            </div>

            <div className="bg-surface-2 p-6 rounded-2xl border border-border-1 hover:border-warning/30 transition-colors">
              <div className="w-12 h-12 bg-warning/10 text-warning rounded-xl flex items-center justify-center mb-4">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-bold text-content-1 mb-2">Play Anywhere</h3>
              <p className="text-content-3 leading-relaxed">
                Fully responsive design. Play on your desktop, tablet, or phone with the exact same premium experience.
              </p>
            </div>
          </div>

          <div className="pt-10 border-t border-border-1 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="text-content-2 font-medium flex items-center gap-2">
                Built with <Heart size={16} className="text-error" /> for the community.
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="secondary" className="gap-2" onClick={() => window.open('https://github.com', '_blank')}>
                <Code size={18} /> Source Code
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
