// src/services/stockfish.ts

export type EngineState = 'uninitialized' | 'loading' | 'ready' | 'thinking' | 'error' | 'stopped';

export interface EngineInfo {
  depth?: number;
  score?: { type: 'cp' | 'mate'; value: number }; // cp is centipawns
  pv?: string; // Principal variation
  nodes?: number;
  time?: number;
  nps?: number;
}

export interface EngineResponse {
  bestmove: string;
  ponder?: string;
  info?: EngineInfo;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private state: EngineState = 'uninitialized';
  private currentAnalysisResolve: ((response: EngineResponse) => void) | null = null;
  private currentAnalysisReject: ((reason: Error) => void) | null = null;
  private currentAnalysisId: number = 0;
  private latestInfo: EngineInfo = {};
  
  private engineScript: string;

  constructor(engineScript: string = '/stockfish.js') {
    this.engineScript = engineScript;
  }

  /**
   * Initializes the engine and waits for it to be ready.
   */
  public async init(): Promise<void> {
    if (this.state === 'ready' || this.state === 'loading') {
      return; // Already initialized or initializing
    }

    this.state = 'loading';

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(this.engineScript);
        this.worker.onmessage = (e) => this.handleMessage(e);
        this.worker.onerror = (e) => this.handleError(e);

        // Send UCI init command
        this.send('uci');
        
        // We will consider it ready after 'uciok' and 'readyok'
        // Let's set a temporary listener to wait for readyok
        const onReadyMessage = (e: MessageEvent) => {
          if (typeof e.data === 'string' && e.data === 'readyok') {
            this.state = 'ready';
            this.worker?.removeEventListener('message', onReadyMessage);
            resolve();
          }
        };
        this.worker.addEventListener('message', onReadyMessage);
        
        // Check if ready
        this.send('isready');

      } catch (err) {
        this.state = 'error';
        reject(err);
      }
    });
  }

  /**
   * Flushes the engine pipeline and waits for 'readyok'.
   * Ensures all preceding commands have finished and no stale bestmove remains.
   */
  public async syncReady(): Promise<void> {
    if (this.state === 'uninitialized' || this.state === 'stopped' || this.state === 'error') {
      await this.init();
      return;
    }

    return new Promise((resolve) => {
      const onReady = (e: MessageEvent) => {
        if (typeof e.data === 'string' && e.data.trim() === 'readyok') {
          this.worker?.removeEventListener('message', onReady);
          this.state = 'ready';
          resolve();
        }
      };
      this.worker?.addEventListener('message', onReady);
      this.send('isready');
    });
  }

  /**
   * Stop the current analysis immediately.
   */
  public stop() {
    if (this.state === 'thinking') {
      this.send('stop');
      this.clearAnalysisState();
      this.state = 'ready';
    }
  }

  /**
   * Terminate the worker completely.
   */
  public terminate() {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.state = 'stopped';
    
    if (this.currentAnalysisReject) {
      this.currentAnalysisReject(new Error('Engine terminated'));
      this.clearAnalysisState();
    }
  }

  /**
   * Resets the engine state for a new game.
   */
  public async newGame(): Promise<void> {
    if (this.state === 'uninitialized' || this.state === 'stopped' || this.state === 'error') {
      await this.init();
      return;
    }
    this.send('stop');
    this.clearAnalysisState();
    this.send('ucinewgame');
    await this.syncReady();
    this.state = 'ready';
  }

  /**
   * Analyze a position using depth or movetime.
   */
  public async analyzePosition(fen: string, options: { depth?: number; movetime?: number; skillLevel?: number }): Promise<EngineResponse> {
    if (this.state === 'uninitialized' || this.state === 'stopped' || this.state === 'error') {
      await this.init();
    }

    // If it's already thinking, stop it and wait until ready
    if (this.state === 'thinking') {
      this.send('stop');
      this.clearAnalysisState();
      await this.syncReady();
    }

    return new Promise((resolve, reject) => {
      this.currentAnalysisId++;
      const analysisId = this.currentAnalysisId;
      
      const safeResolve = (response: EngineResponse) => {
        if (this.currentAnalysisId === analysisId) resolve(response);
      };
      const safeReject = (reason: Error) => {
        if (this.currentAnalysisId === analysisId) reject(reason);
      };

      this.currentAnalysisResolve = safeResolve;
      this.currentAnalysisReject = safeReject;
      this.latestInfo = {};
      this.state = 'thinking';

      // Set skill level if provided, otherwise default to maximum (20)
      const skill = options.skillLevel !== undefined ? options.skillLevel : 20;
      this.send(`setoption name Skill Level value ${skill}`);

      this.send(`position fen ${fen}`);
      
      let goCmd = 'go';
      if (options.depth) goCmd += ` depth ${options.depth}`;
      if (options.movetime) goCmd += ` movetime ${options.movetime}`;
      
      this.send(goCmd);
    });
  }

  /**
   * Configure engine options
   */
  public setOption(name: string, value: string | number) {
    this.send(`setoption name ${name} value ${value}`);
  }

  private send(cmd: string) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  private handleMessage(e: MessageEvent) {
    const msg = e.data;
    if (typeof msg !== 'string') return;

    if (msg.startsWith('info ')) {
      this.parseInfo(msg);
    } else if (msg.startsWith('bestmove ')) {
      this.parseBestMove(msg);
    }
  }

  private handleError(e: Event) {
    console.error('Stockfish Worker Error:', e);
    this.state = 'error';
    if (this.currentAnalysisReject) {
      this.currentAnalysisReject(new Error('Worker crashed'));
      this.clearAnalysisState();
    }
  }

  private parseInfo(msg: string) {
    const info: Partial<EngineInfo> = { ...this.latestInfo };
    const tokens = msg.split(' ');

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === 'depth') {
        info.depth = parseInt(tokens[i + 1]);
      } else if (token === 'score') {
        const type = tokens[i + 1] as 'cp' | 'mate';
        const value = parseInt(tokens[i + 2]);
        info.score = { type, value };
      } else if (token === 'nodes') {
        info.nodes = parseInt(tokens[i + 1]);
      } else if (token === 'time') {
        info.time = parseInt(tokens[i + 1]);
      } else if (token === 'nps') {
        info.nps = parseInt(tokens[i + 1]);
      } else if (token === 'pv') {
        info.pv = tokens.slice(i + 1).join(' ');
        break; // PV is usually the last info piece
      }
    }

    this.latestInfo = info as EngineInfo;
  }

  private parseBestMove(msg: string) {
    const tokens = msg.split(' ');
    // 'bestmove e2e4 ponder e7e5'
    const bestmove = tokens[1];
    let ponder: string | undefined = undefined;
    if (tokens.length >= 4 && tokens[2] === 'ponder') {
      ponder = tokens[3];
    }

    const resolve = this.currentAnalysisResolve;
    const info = { ...this.latestInfo };
    this.clearAnalysisState();
    this.state = 'ready';

    if (resolve) {
      resolve({
        bestmove,
        ponder,
        info,
      });
    }
  }

  private clearAnalysisState() {
    this.currentAnalysisResolve = null;
    this.currentAnalysisReject = null;
  }
}

export const stockfishEngine = new StockfishEngine();
