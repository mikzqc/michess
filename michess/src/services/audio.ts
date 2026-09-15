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

  public play(sound: 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'checkmate' | 'stalemate' | 'gameEnd' | 'newGame') {
    if (!this.enabled) return;

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
}

export const audioService = new AudioService();
