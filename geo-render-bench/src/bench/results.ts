import type { FrameStats } from './harness';

// Color-codes each row by how close p95 sits to the refresh ceiling: green = the
// engine is refresh-capped (headroom to spare), yellow = some jank, red = GPU-bound.
export function renderResults(el: HTMLElement, rows: FrameStats[]): void {
  el.hidden = rows.length === 0;
  const fmt = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : '—');
  const cls = (s: FrameStats): string => {
    if (s.skipped) return 'dim';
    if (s.p95 <= 1000 / s.refreshHz + 1) return 'good';
    if (s.jankPct < 20) return 'warn';
    return 'bad';
  };
  const head =
    '<tr><th>engine</th><th>points</th><th>fps</th><th>p50</th><th>p95</th><th>p99</th><th>max</th><th>jank%</th><th>ttfr</th></tr>';
  const body = rows
    .map((s) =>
      s.skipped
        ? `<tr class="dim"><td>${s.engine}</td><td>${s.points.toLocaleString()}</td><td colspan="7">${s.skipped}</td></tr>`
        : `<tr class="${cls(s)}"><td>${s.engine}</td><td>${s.points.toLocaleString()}</td><td>${fmt(s.meanFps)}</td><td>${fmt(s.p50)}</td><td>${fmt(s.p95)}</td><td>${fmt(s.p99)}</td><td>${fmt(s.maxMs)}</td><td>${fmt(s.jankPct)}</td><td>${fmt(s.ttfrMs)}</td></tr>`,
    )
    .join('');
  el.innerHTML = `<table>${head}${body}</table><div class="dim">ms unless noted · green=refresh-capped · red=GPU-bound</div>`;
}

export function downloadJSON(rows: FrameStats[]): void {
  const meta = {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio,
    viewport: [window.innerWidth, window.innerHeight],
    generatedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify({ meta, results: rows }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geo-render-bench-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
