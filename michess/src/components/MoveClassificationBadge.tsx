import React, { useState } from 'react';
import { CLASSIFICATIONS, type MoveClassificationType } from '../types/classification';

interface MoveClassificationBadgeProps {
  classification: MoveClassificationType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MoveClassificationBadge: React.FC<MoveClassificationBadgeProps> = ({ 
  classification, 
  className = '', 
  size = 'sm' 
}) => {
  const [hasError, setHasError] = useState(false);

  if (classification === 'unclassified') return null;
  
  const cls = CLASSIFICATIONS[classification];
  if (!cls) return null;

  const sizeClass = size === 'lg' ? 'w-9 h-9' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const symbolSizeClass = size === 'lg' ? 'w-9 h-9 text-base' : size === 'md' ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]';

  if (hasError) {
    return (
      <span 
        title={cls.name}
        className={`${symbolSizeClass} ${cls.colorClass} inline-flex items-center justify-center font-black rounded-full shadow-md select-none ${className}`}
      >
        {cls.symbol}
      </span>
    );
  }

  return (
    <img 
      src={`/classification/${classification}.png`}
      alt={cls.name}
      title={`${cls.name} (${cls.symbol})`}
      className={`${sizeClass} object-contain select-none drop-shadow-sm animate-scale-in ${className}`}
      onError={() => setHasError(true)}
    />
  );
};
