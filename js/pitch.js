// Monophonic pitch detection using autocorrelation, tuned for the violin range.

/**
 * Detect the fundamental frequency of a buffer of samples.
 * @param {Float32Array} buf time-domain samples in [-1, 1]
 * @param {number} sampleRate
 * @param {{minFreq?:number,maxFreq?:number,minRms?:number}} [opts]
 * @returns {{freq:number, clarity:number, rms:number}} freq is -1 when no clear pitch.
 */
export function detectPitch(buf, sampleRate, opts = {}) {
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

  // Normalized difference-style autocorrelation (NSDF, as in McLeod's method).
  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let acf = 0;
    let energy = 0;
    for (let j = 0; j < n - lag; j++) {
      const a = buf[j] - mean;
      const b = buf[j + lag] - mean;
      acf += a * b;
      energy += a * a + b * b;
    }
    nsdf[lag] = energy > 0 ? (2 * acf) / energy : 0;
  }

  // Collect the highest point of each positive lobe after the first zero crossing.
  const peaks = [];
  let lag = minLag;
  while (lag <= maxLag && nsdf[lag] > 0) lag++; // leave the zero-lag lobe
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
  // Pick the first peak that is nearly as strong as the best one (avoids octave-down errors).
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * maxVal);

  // Parabolic interpolation around the chosen lag.
  const y0 = nsdf[chosen - 1];
  const y1 = nsdf[chosen];
  const y2 = nsdf[chosen + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const period = chosen + Math.max(-1, Math.min(1, shift));

  const clarity = y1;
  if (clarity < 0.6) return { freq: -1, clarity, rms };
  return { freq: sampleRate / period, clarity, rms };
}

/** Rolling median smoother for noisy pitch readings. */
export class PitchSmoother {
  constructor(size = 5) {
    this.size = size;
    this.values = [];
  }
  push(midi) {
    if (midi == null) { this.values = []; return null; }
    // Reset if the pitch jumps more than a semitone (a new note).
    const last = this.values[this.values.length - 1];
    if (last != null && Math.abs(last - midi) > 1) this.values = [];
    this.values.push(midi);
    if (this.values.length > this.size) this.values.shift();
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}
