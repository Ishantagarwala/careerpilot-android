export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  license: string;
}

export const APPROVED_TRACKS: AudioTrack[] = [
  {
    id: 'sh-1',
    title: 'SoundHelix Song 1',
    artist: 'SoundHelix (CC-BY 3.0)',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    license: 'Creative Commons Attribution 3.0',
  },
  {
    id: 'sh-2',
    title: 'SoundHelix Song 2',
    artist: 'SoundHelix (CC-BY 3.0)',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    license: 'Creative Commons Attribution 3.0',
  },
  {
    id: 'sh-3',
    title: 'SoundHelix Song 3',
    artist: 'SoundHelix (CC-BY 3.0)',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    license: 'Creative Commons Attribution 3.0',
  },
];

export type AudioPlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'interrupted' | 'error';

export interface AudioStatus {
  state: AudioPlaybackState;
  currentTrack: AudioTrack;
  errorMessage: string | null;
}

type AudioStatusListener = (status: AudioStatus) => void;

class AudioService {
  private currentTrackIndex = 0;
  private state: AudioPlaybackState = 'idle';
  private errorMessage: string | null = null;
  private listeners: Set<AudioStatusListener> = new Set();
  private audioElement: any = null;

  constructor() {
    this.initAudioElement();
  }

  private initAudioElement() {
    if (typeof window !== 'undefined' && typeof (window as any).Audio !== 'undefined') {
      try {
        this.audioElement = new (window as any).Audio();
        this.audioElement.preload = 'none';

        this.audioElement.addEventListener('play', () => {
          this.setState('playing');
        });

        this.audioElement.addEventListener('pause', () => {
          if (this.state === 'playing') {
            this.setState('paused');
          }
        });

        this.audioElement.addEventListener('waiting', () => {
          this.setState('loading');
        });

        this.audioElement.addEventListener('ended', () => {
          // Loop current track or transition to next
          this.nextTrack(true);
        });

        this.audioElement.addEventListener('error', () => {
          this.setState('error', 'Network error or unable to play audio stream');
        });
      } catch {
        this.audioElement = null;
      }
    }
  }

  public getStatus(): AudioStatus {
    return {
      state: this.state,
      currentTrack: APPROVED_TRACKS[this.currentTrackIndex],
      errorMessage: this.errorMessage,
    };
  }

  public subscribe(listener: AudioStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  private setState(state: AudioPlaybackState, errorMessage: string | null = null) {
    this.state = state;
    this.errorMessage = errorMessage;
    this.notify();
  }

  /**
   * Explicit user intent: play the current track.
   * Never triggered automatically without user action.
   */
  public async play(): Promise<void> {
    const track = APPROVED_TRACKS[this.currentTrackIndex];
    this.setState('loading', null);

    if (this.audioElement) {
      try {
        if (this.audioElement.src !== track.url) {
          this.audioElement.src = track.url;
        }
        await this.audioElement.play();
        this.setState('playing', null);
      } catch {
        this.setState('error', 'Failed to start playback. Check internet connection.');
      }
    } else {
      // Non-browser / simulation mode: acknowledge explicit intent and mark playing
      this.setState('playing', null);
    }
  }

  /**
   * Explicit user intent: pause playback
   */
  public pause(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
      } catch {
        // Ignore
      }
    }
    this.setState('paused', null);
  }

  /**
   * Stop playback completely and reset to idle
   */
  public stop(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // Ignore
      }
    }
    this.setState('idle', null);
  }

  /**
   * Handle audio interruption (e.g. phone call, alarm, or focus loss)
   */
  public handleInterruption(reason: string = 'Audio interrupted by system'): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
      } catch {
        // Ignore
      }
    }
    this.setState('interrupted', reason);
  }

  /**
   * Next track
   */
  public nextTrack(autoPlay: boolean = false): void {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % APPROVED_TRACKS.length;
    if (autoPlay && this.state === 'playing') {
      this.play();
    } else {
      this.stop();
    }
  }

  /**
   * Select a specific track by index
   */
  public selectTrack(index: number): void {
    if (index >= 0 && index < APPROVED_TRACKS.length) {
      const wasPlaying = this.state === 'playing';
      this.currentTrackIndex = index;
      if (wasPlaying) {
        this.play();
      } else {
        this.stop();
      }
    }
  }
}

export const audioService = new AudioService();
