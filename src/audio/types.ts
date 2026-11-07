export type PitchReading = {
  /** Detected frequency in Hz, or -1 when no clear pitch. */
  freq: number;
  /** Smoothed fractional MIDI note, or null when silent/unclear. */
  midi: number | null;
  rms: number;
  /** performance.now() timestamp in ms. */
  time: number;
};

export type PitchListener = {
  start: () => Promise<void>;
  stop: () => void;
  listening: boolean;
};
