export interface Favorite {
  id: string;
  uid: string;
  type: 'track' | 'visualizer';
  externalId: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  source?: 'spotify' | 'youtube' | 'local';
  url?: string;
  order?: number;
  createdAt: any;
}

export interface UserSetting {
  uid: string;
  theme: string;
  visualizerMode: string;
}

export type VisualizerMode =
  | 'oscilloscope'
  | 'spectrum'
  | 'plasma'
  | 'bars'
  | 'circles'
  | 'mirrorBars'
  | 'radialPulse'
  | 'waveDots';

export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  source: 'spotify' | 'youtube' | 'local';
  url?: string;
}
