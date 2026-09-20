import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

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
    <Modal isOpen={true} onClose={onCancel} title={title} maxWidth="sm">
      <div className="flex flex-col gap-6 p-5">
        <p className="text-content-2 text-sm">{message}</p>
        
        <div className="flex justify-end gap-3 mt-2">
          <Button 
            variant="ghost" 
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
