import moveSfx from '../assets/sounds/move.mp3';
import captureSfx from '../assets/sounds/capture.mp3';
import checkSfx from '../assets/sounds/check.mp3';
import promoteSfx from '../assets/sounds/promote.mp3';

class AudioService {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  constructor() {
    this.loadSettings();
    this.preloadSounds();
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem('michess_audio_enabled');
      if (stored !== null) {
        this.enabled = stored === 'true';
      }
    } catch (e) {
      console.error('Failed to load audio settings', e);
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem('michess_audio_enabled', String(enabled));
    } catch (e) {
      console.error('Failed to save audio settings', e);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private soundFiles: Record<string, string> = {
    move: moveSfx,
    capture: captureSfx,
    check: checkSfx,
    gameEnd: checkSfx,
    castle: moveSfx,
    promote: promoteSfx,
    newGame: checkSfx
  };

  private preloadSounds() {
    // We intentionally don't create new Audio() here anymore.
    // Creating them on module load causes iOS Safari to permanently block them
    // because they weren't created inside a user gesture.
    // We will lazy-initialize them in play().
  }

  private audioCtx: AudioContext | null = null;

  private initWebAudio() {
    if (!this.audioCtx) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContext();
      } catch (e) {
        console.warn('Web Audio API not supported', e);
      }
    }
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (!this.enabled) return;
    this.initWebAudio();
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      
      gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn(e);
    }
  }

  public playNotify() {
    this.playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 100);
  }
  
  public playVictory() {
    this.playTone(400, 'triangle', 0.1, 0.1);
    setTimeout(() => this.playTone(500, 'triangle', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(600, 'triangle', 0.3, 0.15), 200);
  }

  public playDefeat() {
    this.playTone(300, 'sawtooth', 0.2, 0.05);
    setTimeout(() => this.playTone(250, 'sawtooth', 0.4, 0.05), 200);
  }
  
  public playDraw() {
    this.playTone(400, 'sine', 0.3, 0.1);
    setTimeout(() => this.playTone(400, 'sine', 0.3, 0.1), 300);
  }

  public play(sound: 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'checkmate' | 'stalemate' | 'gameEnd' | 'newGame') {
    if (!this.enabled) return;
    this.initWebAudio();

    let soundKey = sound;
    if (sound === 'checkmate' || sound === 'stalemate') soundKey = 'gameEnd';
    
    let audio = this.sounds.get(soundKey);
    
    // Lazy initialize inside the user gesture
    if (!audio) {
      const src = this.soundFiles[soundKey];
      if (src) {
        audio = new Audio(src);
        this.sounds.set(soundKey, audio);
      }
    }

    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Audio playback prevented by browser:', err);
      });
    }
  }
  public playMove(moveInfo: { san: string, flags: string }) {
    if (moveInfo.san.includes('#') || moveInfo.san.includes('+')) this.play('check');
    else if (moveInfo.san.includes('x')) this.play('capture');
    else if (moveInfo.flags.includes('p')) this.play('promote');
    else if (moveInfo.flags.includes('k') || moveInfo.flags.includes('q')) this.play('castle');
    else this.play('move');
  }
}

export const audioService = new AudioService();
