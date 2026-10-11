import React from 'react';
import { X, Globe } from 'lucide-react';
import { LinkedAccountsCard } from './LinkedAccountsCard';

interface LinkedAccountsModalProps {
  onClose: () => void;
  onOpenIntelligence?: () => void;
}

export const LinkedAccountsModal: React.FC<LinkedAccountsModalProps> = ({ onClose, onOpenIntelligence }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-surface-1 border border-border-1 rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-1 bg-surface-2">
          <div className="flex items-center gap-2.5">
            <Globe className="text-accent" size={20} />
            <h2 className="text-lg font-bold text-content-1">Link External Accounts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
          <LinkedAccountsCard 
            onOpenIntelligence={() => {
              onClose();
              if (onOpenIntelligence) onOpenIntelligence();
            }}
          />
        </div>
      </div>
    </div>
  );
};
