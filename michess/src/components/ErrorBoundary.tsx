import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, LogOut } from 'lucide-react';
import { supabase } from '../services/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Michess ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleSignOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      localStorage.clear();
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-1 text-content-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none">
          <div className="max-w-md w-full bg-surface-2 border border-border-1 rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertTriangle size={36} />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-content-1 mb-2 font-mono uppercase tracking-wide">
              Something went wrong
            </h1>

            <p className="text-xs sm:text-sm text-content-2 mb-6">
              Michess encountered an unexpected display issue. Your game records and account data remain completely safe.
            </p>

            {this.state.error && (
              <div className="bg-surface-3/80 border border-border-1 rounded-xl p-3 mb-6 text-left overflow-x-auto max-h-32 text-[11px] font-mono text-content-3">
                {this.state.error.message || 'Unknown error occurred'}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <RefreshCw size={16} />
                <span>Reload Page</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 py-2 px-3 rounded-xl bg-surface-3 hover:bg-surface-3/80 text-content-1 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-border-1 active:scale-95"
                >
                  <Home size={14} />
                  <span>Go to Home</span>
                </button>

                <button
                  onClick={this.handleSignOut}
                  className="flex-1 py-2 px-3 rounded-xl bg-surface-3 hover:bg-red-950/40 text-red-300 hover:text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-border-1 hover:border-red-900/60 active:scale-95"
                >
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
