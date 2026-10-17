import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Tv, 
  Sliders, 
  Volume2, 
  VolumeX, 
  FileText, 
  AlertTriangle, 
  Radio
} from 'lucide-react';
import { Button } from './ui/Button';

interface NotFoundAreaProps {
  onExit: () => void;
}

export const NotFoundArea: React.FC<NotFoundAreaProps> = ({ onExit }) => {
  const [glitchActive, setGlitchActive] = useState(false);
  const [trackingOffset, setTrackingOffset] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [frameCounter, setFrameCounter] = useState(18);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // Audio Context Ref for CRT 60Hz hum + tape hiss
  const audioCtxRef = useRef<AudioContext | null>(null);
  const humOscRef = useRef<OscillatorNode | null>(null);
  const humGainRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  // Setup periodic analog glitch & frame increment
  useEffect(() => {
    const frameInterval = setInterval(() => {
      setFrameCounter(prev => (prev >= 29 ? 0 : prev + 1));
    }, 100);

    const randomGlitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTrackingOffset(Math.floor(Math.random() * 8) - 4);
      setTimeout(() => {
        setGlitchActive(false);
        setTrackingOffset(0);
      }, 180);
    }, 4000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(randomGlitchInterval);
    };
  }, []);

  // Audio synthesis: Web Audio API CRT hum + gentle tape hiss
  const stopAudio = useCallback(() => {
    try {
      if (humOscRef.current) {
        humOscRef.current.stop();
        humOscRef.current.disconnect();
        humOscRef.current = null;
      }
      if (noiseSourceRef.current) {
        noiseSourceRef.current.stop();
        noiseSourceRef.current.disconnect();
        noiseSourceRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch {
      // Audio cleanup error handling
    }
  }, []);

  const startAudio = useCallback(() => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        return;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // 1. 60Hz CRT Hum oscillator
      const humOsc = ctx.createOscillator();
      const humFilter = ctx.createBiquadFilter();
      const humGain = ctx.createGain();

      humOsc.type = 'sine';
      humOsc.frequency.setValueAtTime(60, ctx.currentTime);

      humFilter.type = 'lowpass';
      humFilter.frequency.setValueAtTime(140, ctx.currentTime);

      // Low, atmospheric rumble
      humGain.gain.setValueAtTime(0.04, ctx.currentTime);

      humOsc.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(ctx.destination);
      humOsc.start();

      humOscRef.current = humOsc;
      humGainRef.current = humGain;

      // 2. Soft tape hiss / static
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.015;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(1.5, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.025, ctx.currentTime);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start();

      noiseSourceRef.current = whiteNoise;
      noiseGainRef.current = noiseGain;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Audio context policy or unavailable
    }
  }, []);

  const toggleSound = () => {
    if (soundEnabled) {
      stopAudio();
      setSoundEnabled(false);
    } else {
      startAudio();
      setSoundEnabled(true);
    }
  };

  // Start audio on mount (default ON) and handle browser autoplay resumption
  useEffect(() => {
    startAudio();

    const handleFirstInteraction = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      stopAudio();
    };
  }, [startAudio, stopAudio]);

  const handleManualTracking = () => {
    setGlitchActive(true);
    setTrackingOffset(12);
    setTimeout(() => {
      setTrackingOffset(-6);
      setTimeout(() => {
        setTrackingOffset(0);
        setGlitchActive(false);
      }, 150);
    }, 150);
  };

  // Glitched board cells for the impossible board
  const corruptedBoard = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '?', '?', '♟', '♟', '♟'],
    ['·', '·', '·', '†', '‡', '·', '·', '·'],
    ['·', '·', '·', '♚', '♔', '·', '·', '·'], // Two kings touching: illegal contact
    ['·', '·', '·', 'Ø', 'Ø', '·', '·', '·'],
    ['·', '·', '·', '·', '·', '·', '·', '·'],
    ['♙', '♙', '♙', '·', '·', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '·', '♗', '♘', '♖'],
  ];

  const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <div className="flex-1 w-full min-h-[calc(100vh-4rem)] flex flex-col relative overflow-y-auto bg-[#050505] text-[#d4d4d4] font-mono select-none crt-container">
      {/* 1. CRT Curved Vignette & Raster Overlay */}
      <div className="pointer-events-none fixed inset-0 z-30 crt-overlay" />
      <div className="pointer-events-none fixed inset-0 z-20 scanlines opacity-60" />
      <div 
        className={`pointer-events-none fixed inset-0 z-25 vhs-tracking-bar transition-opacity duration-75 ${
          glitchActive ? 'opacity-90 block' : 'opacity-20'
        }`}
      />

      {/* 2. Top VCR / Broadcast OSD Bar */}
      <header className="relative z-40 w-full px-4 sm:px-6 py-2 border-b border-red-900/40 bg-black/90 flex flex-wrap items-center justify-between text-[11px] text-red-500/90 tracking-wider">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-red-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span>REC ●</span>
          </span>
          <span className="text-zinc-500">|</span>
          <span className="font-bold text-red-500/80">PLAY ▶ SP</span>
          <span className="hidden sm:inline text-zinc-500">|</span>
          <span className="hidden sm:inline text-zinc-400 font-mono">
            OCT 17 1994  03:14:04:{frameCounter.toString().padStart(2, '0')}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 mt-1 sm:mt-0">
          <span className="text-[10px] text-zinc-400 font-mono hidden md:inline">
            CH-04 // NTSC 480i
          </span>
          <button
            onClick={toggleSound}
            className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
              soundEnabled 
                ? 'bg-red-950/60 border-red-600 text-red-300 shadow-[0_0_8px_rgba(255,0,0,0.4)]' 
                : 'bg-black border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Toggle authentic CRT hum and tape hiss"
          >
            {soundEnabled ? <Volume2 size={12} className="text-red-400" /> : <VolumeX size={12} />}
            <span>AUDIO: {soundEnabled ? 'ON [60Hz]' : 'MUTED'}</span>
          </button>
        </div>
      </header>

      {/* 3. Main Analog Horror Viewport */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start sm:justify-center px-4 sm:px-6 py-4 sm:py-6 max-w-4xl mx-auto w-full text-center">
        {/* Emergency Alert Header Banner */}
        <div className="mb-2 px-3 py-1 rounded bg-red-950/40 border border-red-800/60 text-red-400 text-[10px] sm:text-xs tracking-widest uppercase flex items-center gap-2 shadow-[0_0_15px_rgba(180,0,0,0.3)] animate-pulse">
          <Radio size={13} className="text-red-500 animate-spin" />
          <span>NATIONAL ARCHIVAL SERVICE // UNLAWFUL COORDINATE EVENT</span>
          <AlertTriangle size={13} className="text-red-500" />
        </div>

        {/* Big Glitched 404 Header with Chromatic Shift */}
        <div className="relative mb-1">
          <h1 
            className={`text-6xl sm:text-7xl font-black tracking-tighter text-red-600 select-none chromatic-text ${
              glitchActive ? 'glitch-skew' : ''
            }`}
            style={{
              transform: `translate(${trackingOffset}px, 0px)`
            }}
          >
            404
          </h1>
          <div 
            className="absolute inset-0 text-6xl sm:text-7xl font-black tracking-tighter text-cyan-400 opacity-30 pointer-events-none mix-blend-screen"
            style={{
              transform: `translate(${-trackingOffset * 1.5}px, -2px)`
            }}
          >
            404
          </div>
        </div>

        {/* Incident Subtitle */}
        <div className="space-y-0.5 mb-3">
          <p className="text-sm sm:text-lg font-bold tracking-widest text-red-400 uppercase">
            [ ERROR 404: THE 65TH SQUARE ]
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 tracking-wider">
            SQUARE NOT FOUND IN 8x8 GEOMETRY // GAME RECORD DAMAGED
          </p>
        </div>

        {/* Narrative / Analog Horror Chess Card */}
        <div className="w-full max-w-2xl bg-black/90 border border-red-900/60 rounded-lg p-3.5 sm:p-5 mb-5 text-left shadow-[0_0_25px_rgba(0,0,0,0.9)] backdrop-blur-sm relative overflow-hidden">
          {/* Subtle tape label strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-900 via-red-600 to-red-900 opacity-80" />
          
          <div className="flex flex-col md:flex-row items-center gap-5">
            {/* The Impossible 8x8 Glitched Board */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="text-[9px] text-red-500/70 font-mono mb-1 uppercase tracking-wider flex items-center gap-1">
                <span>EVAL: -∞</span>
                <span className="text-zinc-600">•</span>
                <span>FEN: CORRUPTED</span>
              </div>

              <div className="border border-red-900/80 bg-zinc-950 p-1 rounded shadow-[0_0_15px_rgba(255,0,0,0.15)]">
                <div className="grid grid-cols-8 gap-0.5 text-center text-[11px] sm:text-xs font-serif">
                  {corruptedBoard.map((row, rIdx) => 
                    row.map((cell, cIdx) => {
                      const isDark = (rIdx + cIdx) % 2 === 1;
                      const isCenterTouchingKings = (rIdx === 3 && (cIdx === 3 || cIdx === 4));
                      const isHovered = selectedSquare === `${files[cIdx]}${8 - rIdx}`;
                      
                      return (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          onMouseEnter={() => setSelectedSquare(`${files[cIdx]}${8 - rIdx}`)}
                          onMouseLeave={() => setSelectedSquare(null)}
                          className={`w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 flex items-center justify-center cursor-pointer transition-colors ${
                            isCenterTouchingKings
                              ? 'bg-red-900/70 text-red-200 animate-pulse font-bold'
                              : isHovered
                              ? 'bg-red-950 text-white'
                              : isDark
                              ? 'bg-zinc-900 text-zinc-400'
                              : 'bg-zinc-800 text-zinc-300'
                          } ${cell === '?' || cell === 'Ø' ? 'text-red-400 font-mono font-bold' : ''}`}
                          title={`Square ${files[cIdx]}${8 - rIdx}: ${cell}`}
                        >
                          {cell}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-1.5 text-[9px] text-zinc-500 font-mono">
                {selectedSquare ? `SQUARE [${selectedSquare}]: VOID STATE` : 'HOVER SQUARES FOR ANOMALY'}
              </div>
            </div>

            {/* Emergency Directives (Analog Horror Training Tape Style) */}
            <div className="flex-1 space-y-2 text-xs leading-relaxed text-zinc-300">
              <div className="border-b border-red-950 pb-1 text-red-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>PUBLIC SAFETY DIRECTIVE 404</span>
                <span className="text-[9px] text-zinc-500">TAPE #1994-CHESS</span>
              </div>

              <ul className="space-y-1 text-[10px] sm:text-[11px] text-zinc-400 list-disc list-inside">
                <li><strong className="text-red-400">DO NOT ATTEMPT TO RESIGN.</strong> The clock has stopped receiving player input.</li>
                <li><strong className="text-zinc-200">DO NOT TOUCH THE BLACK KING.</strong> It is no longer under the control of an opponent.</li>
                <li><strong className="text-zinc-200">DO NOT LOOK AT THE CORNER SQUARES.</strong> The pieces on rank 9 were not placed by human hands.</li>
                <li><strong className="text-zinc-200">IF YOU HEAR WHISPERING ON THE E-FILE,</strong> step back from the board and eject the tape immediately.</li>
              </ul>

              <p className="text-[10px] sm:text-[11px] text-red-500/90 italic pt-1 border-t border-red-950/60 font-serif">
                &ldquo;You have stepped outside the 64 squares. The piece you moved cannot be returned.&rdquo;
              </p>
            </div>
          </div>

          {/* Expandable Blackbox Incident Log */}
          {showLogs && (
            <div className="mt-3 pt-2.5 border-t border-red-950/80 font-mono text-[9px] sm:text-[10px] text-zinc-400 space-y-1 bg-black/60 p-2.5 rounded border border-zinc-900">
              <div className="text-red-400 font-bold mb-0.5 flex items-center gap-1.5">
                <FileText size={11} />
                <span>ARCHIVAL DE-CLASSIFICATION LOGS // OCT 17 1994</span>
              </div>
              <p className="text-zinc-500">[03:12:00] VHS tape retrieved from locked cabinet at Saint Jude Chess Pavilion.</p>
              <p className="text-zinc-500">[03:13:21] Player White initiates move 4. ...Kf8 into an undocumented rank.</p>
              <p className="text-red-400/90">[03:14:04] FEN corruption observed. Both kings occupy identical spatial coordinates.</p>
              <p className="text-red-500">[03:14:48] Broadcaster signal interrupted. URL string wiped from memory banks.</p>
              <p className="text-zinc-600">[03:15:00] End of recording. Viewer advised to disengage interface.</p>
            </div>
          )}
        </div>

        {/* 4. VHS Deck / Tactical Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
          {/* Main Return Button */}
          <Button
            onClick={onExit}
            variant="primary"
            size="lg"
            className="w-full sm:w-auto px-6 py-3 font-mono font-bold tracking-wider uppercase text-xs sm:text-sm bg-red-700 hover:bg-red-600 text-white border border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.5)] cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <ArrowLeft size={16} />
            <span>⏏ EMERGENCY EJECT // RETURN HOME</span>
          </Button>

          {/* Adjust Tracking Button */}
          <button
            onClick={handleManualTracking}
            className="px-3.5 py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
            title="Recalibrate analog tracking"
          >
            <Sliders size={14} className="text-red-400" />
            <span>ADJUST TRACKING</span>
          </button>

          {/* Toggle Incident Logs */}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-3.5 py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
            title="Read incident blackbox transcript"
          >
            <FileText size={14} className="text-zinc-400" />
            <span>{showLogs ? 'HIDE LOGS' : 'INCIDENT LOGS'}</span>
          </button>
        </div>
      </main>

      {/* 5. Bottom VCR Tracking Info */}
      <footer className="relative z-40 w-full px-4 sm:px-6 py-2 border-t border-red-950 bg-black/90 flex flex-wrap items-center justify-between text-[10px] text-zinc-600">
        <div className="flex items-center gap-2">
          <Tv size={12} className="text-red-900" />
          <span>MICHESS ANALOG ARCHIVE SYSTEM // TAPE #404-B</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-red-950">HI-FI TRACKING: MANUAL</span>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <span className="text-zinc-600">FIDE STANDARD REJECTED</span>
        </div>
      </footer>

      {/* Scoped Analog Horror CSS Animations & Effects */}
      <style dangerouslySetInnerHTML={{__html: `
        /* CRT Vignette Edge Curvature */
        .crt-container {
          box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.95), inset 0 0 40px rgba(180, 0, 0, 0.15);
        }

        .crt-overlay {
          background: radial-gradient(circle at center, transparent 65%, rgba(0, 0, 0, 0.85) 100%);
        }

        /* Scanline raster lines */
        .scanlines {
          background: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.03) 0px,
            rgba(255, 255, 255, 0.03) 1px,
            transparent 1px,
            transparent 3px
          );
        }

        /* VHS Tracking sweep bar */
        .vhs-tracking-bar {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255, 50, 50, 0.06) 48%,
            rgba(255, 255, 255, 0.18) 50%,
            rgba(255, 50, 50, 0.06) 52%,
            transparent 100%
          );
          height: 80px;
          animation: vhsTracking 7s linear infinite;
        }

        @keyframes vhsTracking {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        /* Chromatic Aberration Text Effect */
        .chromatic-text {
          text-shadow: -2px 0 rgba(255, 0, 0, 0.8), 2px 0 rgba(0, 255, 255, 0.7);
        }

        .glitch-skew {
          animation: glitchSkew 0.2s steps(2, end) infinite;
        }

        @keyframes glitchSkew {
          0% { transform: translate(2px, -1px) skewX(-2deg); }
          50% { transform: translate(-3px, 2px) skewX(3deg); }
          100% { transform: translate(1px, 0px) skewX(0deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .vhs-tracking-bar, .glitch-skew {
            animation: none !important;
          }
        }
      `}} />
    </div>
  );
};
