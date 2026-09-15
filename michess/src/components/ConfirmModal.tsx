import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel 
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onCancel}>
      <div 
        className="bg-chess-panel border border-chess-border rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden text-slate-300 relative flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400">{message}</p>
        </div>
        <div className="p-4 bg-slate-900/50 flex justify-end gap-3 border-t border-chess-border">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded font-medium text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
