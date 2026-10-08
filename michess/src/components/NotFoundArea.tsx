import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';

interface NotFoundAreaProps {
  onExit: () => void;
}

export const NotFoundArea: React.FC<NotFoundAreaProps> = ({ onExit }) => {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 3000);

    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <div className="flex-1 w-full flex flex-col relative overflow-hidden bg-black text-white h-screen select-none">
      {/* Glitch Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 z-0" 
        style={{
          backgroundImage: 'radial-gradient(circle, transparent 20%, #000 120%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          backgroundSize: '100% 100%, 100% 4px',
          animation: glitch ? 'pulse 0.1s infinite' : 'none'
        }}
      />

      {/* Creepy chess board floor */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/2 opacity-10"
        style={{
          background: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)',
          backgroundSize: '60px 60px',
          backgroundPosition: '0 0, 30px 30px',
          backgroundColor: '#333',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))'
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-6 text-center">
        <h1 
          className={`text-[8rem] sm:text-[12rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-900 to-black drop-shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all duration-75 ${glitch ? 'translate-x-1 -translate-y-2 skew-x-12 opacity-80' : ''}`}
          style={{ textShadow: glitch ? '4px 0 #f00, -4px 0 #0ff' : 'none' }}
        >
          404
        </h1>
        
        <p className="text-2xl sm:text-3xl font-light text-red-500/80 mt-[-2rem] mb-6 tracking-widest uppercase">
          You stepped off the board.
        </p>

        <p className="max-w-md text-gray-500 mb-12 animate-pulse text-sm">
          There are no pieces here. No moves to make. Only the void. The game cannot proceed.
        </p>

        <Button 
          onClick={onExit}
          variant="secondary"
          className="border-red-900/30 hover:border-red-500 hover:bg-red-950/30 text-red-500 transition-all duration-500"
        >
          <ArrowLeft size={18} className="mr-2" /> Return to reality
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.02); filter: brightness(1.5); }
          100% { transform: scale(1); filter: brightness(1); }
        }
      `}} />
    </div>
  );
};
