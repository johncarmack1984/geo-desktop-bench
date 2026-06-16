// Frame-time capture and aggregation. The honest primary metric for a
// GPU-bound renderer is the frame-time DISTRIBUTION, not mean FPS: requestAnimationFrame
// is capped at the display refresh (60/120Hz), so a fast engine just pins the cap
// and the interesting signal is the tail — p95/p99 and the share of dropped frames.

export interface FrameStats {
  engine: string;
  points: number;
  reps: number;
  refreshHz: number;
  meanFps: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
  jankPct: number;
  ttfrMs: number;
  frameCount: number;
  skipped?: string;
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.floor((p / 100) * sortedAsc.length),
  );
  return sortedAsc[idx];
}

// Drive rAF for durationMs, calling onFrame(t01, dtMs) each frame BEFORE the
// browser paints. Returns per-frame intervals in ms; the first is dropped (it
// includes the scheduling gap before the loop settled).
export function captureFrames(
  durationMs: number,
  onFrame: (t01: number, dtMs: number) => void,
): Promise<number[]> {
  return new Promise((resolve) => {
    const intervals: number[] = [];
    let last = performance.now();
    const start = last;
    const tick = (now: number): void => {
      const dt = now - last;
      last = now;
      const elapsed = now - start;
      onFrame(Math.min(elapsed / durationMs, 1), dt);
      intervals.push(dt);
      if (elapsed < durationMs) requestAnimationFrame(tick);
      else resolve(intervals.slice(1));
    };
    requestAnimationFrame(tick);
  });
}

// Infer the display refresh from the median observed interval (≈16.7ms→60Hz,
// ≈8.3ms→120Hz ProMotion). Used to set the jank threshold honestly per-display.
export function detectRefreshHz(intervalsMs: number[]): number {
  if (intervalsMs.length === 0) return 60;
  const sorted = [...intervalsMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.round(1000 / median);
}

export function summarize(
  engine: string,
  points: number,
  reps: number,
  refreshHz: number,
  ttfrMs: number,
  intervals: number[],
): FrameStats {
  const sorted = [...intervals].sort((a, b) => a - b);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  // A frame slower than 1.5x the refresh interval is a dropped/janky frame.
  const jankThreshold = (1000 / refreshHz) * 1.5;
  const janky = intervals.filter((d) => d > jankThreshold).length;
  return {
    engine,
    points,
    reps,
    refreshHz,
    meanFps: 1000 / mean,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    maxMs: sorted[sorted.length - 1],
    jankPct: (janky / intervals.length) * 100,
    ttfrMs,
    frameCount: intervals.length,
  };
}
