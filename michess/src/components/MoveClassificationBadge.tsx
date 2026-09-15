import React from 'react';
import { CLASSIFICATIONS, type MoveClassificationType } from '../types/classification';

interface MoveClassificationBadgeProps {
  classification: MoveClassificationType;
  className?: string;
  size?: 'sm' | 'lg';
}

export const MoveClassificationBadge: React.FC<MoveClassificationBadgeProps> = ({ classification, className = '', size = 'sm' }) => {
  if (classification === 'unclassified') return null;
  
  const cls = CLASSIFICATIONS[classification];
  if (!cls) return null;

  const sizeClass = size === 'lg' ? 'w-10 h-10' : 'w-5 h-5';

  return (
    <img 
      src={`/classification/${classification}.png`}
      alt={cls.name}
      title={cls.name}
      className={`${sizeClass} object-contain select-none drop-shadow-sm animate-scale-in ${className}`}
      onError={(e) => {
        // Fallback to avoid broken image icons if a specific classification PNG is missing
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};
