import React from 'react';

interface EvaluationBarProps {
  score?: { type: 'cp' | 'mate'; value: number };
  orientation?: 'white' | 'black';
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({ score, orientation = 'white' }) => {
  let whiteAdvantage = 50; // 50% is equal
  let scoreText = '0.0';

  if (score) {
    if (score.type === 'mate') {
      // Mate in X
      const mateIn = score.value;
      scoreText = `M${Math.abs(mateIn)}`;
      // If mate in > 0, white is winning. If < 0, black is winning.
      whiteAdvantage = mateIn > 0 ? 100 : 0;
    } else {
      // Centipawns
      const cp = score.value;
      scoreText = (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
      
      // Calculate visual fill percentage
      // Cap at +/- 10 pawns
      const cappedCp = Math.max(-1000, Math.min(1000, cp));
      // Formula: 50% + (cp / 1000) * 50%
      whiteAdvantage = 50 + (cappedCp / 1000) * 50;
    }
  }

  const fillPercent = orientation === 'white' ? whiteAdvantage : (100 - whiteAdvantage);
  


  return (
    <div className="w-6 md:w-8 h-[600px] bg-slate-800 rounded-sm overflow-hidden flex flex-col relative border border-gray-700">
      {/* The bar fills from bottom to top in CSS, so a height of X% from bottom */}
      <div 
        className="absolute bottom-0 w-full bg-slate-200 transition-all duration-200 ease-out"
        style={{ height: `${fillPercent}%` }}
      />
      
      {/* Display text */}
      {scoreText !== '0.0' && (
        <div 
          className={`absolute bottom-2 w-full text-center text-xs font-bold z-10 ${
            (orientation === 'white' && whiteAdvantage > 50) || (orientation === 'black' && whiteAdvantage < 50) 
              ? 'text-slate-800' 
              : 'text-slate-200'
          }`}
        >
          {scoreText}
        </div>
      )}
    </div>
  );
};
