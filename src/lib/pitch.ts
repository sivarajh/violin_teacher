// Monophonic pitch detection (normalized autocorrelation / McLeod-style), tuned for violin.

export type PitchResult = { freq: number; clarity: number; rms: number };

export function detectPitch(
  buf: ArrayLike<number>,
  sampleRate: number,
  opts: { minFreq?: number; maxFreq?: number; minRms?: number } = {},
): PitchResult {
  const minFreq = opts.minFreq ?? 170; // a bit below open G (196 Hz)
  const maxFreq = opts.maxFreq ?? 3600;
  const minRms = opts.minRms ?? 0.01;
  const n = buf.length;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += buf[i];
  mean /= n;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += (buf[i] - mean) ** 2;
  rms = Math.sqrt(rms / n);
  if (rms < minRms) return { freq: -1, clarity: 0, rms };

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / minFreq));
  if (maxLag <= minLag) return { freq: -1, clarity: 0, rms };

  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf[i] - mean;

  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let acf = 0;
    let energy = 0;
    for (let j = 0; j < n - lag; j++) {
      const a = x[j];
      const b = x[j + lag];
      acf += a * b;
      energy += a * a + b * b;
    }
    nsdf[lag] = energy > 0 ? (2 * acf) / energy : 0;
  }

  // Highest point of each positive lobe after the first zero crossing.
  const peaks: number[] = [];
  let lag = minLag;
  while (lag <= maxLag && nsdf[lag] > 0) lag++;
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag] <= 0) lag++;
    let best = -1;
    let bestVal = -Infinity;
    while (lag <= maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > bestVal) { bestVal = nsdf[lag]; best = lag; }
      lag++;
    }
    if (best > 0) peaks.push(best);
  }
  if (!peaks.length) return { freq: -1, clarity: 0, rms };

  let maxVal = 0;
  for (const p of peaks) maxVal = Math.max(maxVal, nsdf[p]);
  // First peak nearly as strong as the best avoids octave-down errors.
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * maxVal)!;

  const y0 = nsdf[chosen - 1];
  const y1 = nsdf[chosen];
  const y2 = nsdf[chosen + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const period = chosen + Math.max(-1, Math.min(1, shift));

  if (y1 < 0.6) return { freq: -1, clarity: y1, rms };
  return { freq: sampleRate / period, clarity: y1, rms };
}

/** Rolling median smoother for noisy pitch readings (in fractional MIDI). */
export class PitchSmoother {
  private values: number[] = [];
  constructor(private size = 5) {}

  push(midi: number | null): number | null {
    if (midi == null) { this.values = []; return null; }
    const last = this.values[this.values.length - 1];
    if (last != null && Math.abs(last - midi) > 1) this.values = [];
    this.values.push(midi);
    if (this.values.length > this.size) this.values.shift();
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}

/** Collects streamed PCM chunks into a fixed-size sliding window. */
export class SampleWindow {
  readonly data: Float32Array;
  private filled = 0;
  constructor(size = 2048) {
    this.data = new Float32Array(size);
  }

  push(chunk: Float32Array) {
    const size = this.data.length;
    if (chunk.length >= size) {
      this.data.set(chunk.subarray(chunk.length - size));
      this.filled = size;
      return;
    }
    this.data.copyWithin(0, chunk.length);
    this.data.set(chunk, size - chunk.length);
    this.filled = Math.min(size, this.filled + chunk.length);
  }

  get ready() {
    return this.filled >= this.data.length;
  }
}
