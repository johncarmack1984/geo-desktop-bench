// Deterministic, scripted web-mercator camera path. Identical for every engine
// and dataset so runs are directly comparable — it pans, zooms, rotates and
// tilts to exercise the whole transform + raster pipeline, not a static frame.

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

// Sweeps across the continental US (where the synthetic data lives), looping
// back to the start so the path is seamless if repeated across reps.
const KEYFRAMES: ViewState[] = [
  { longitude: -98.5, latitude: 39.8, zoom: 3.2, bearing: 0, pitch: 0 },
  { longitude: -118.2, latitude: 34.05, zoom: 5.0, bearing: 20, pitch: 30 },
  { longitude: -96.0, latitude: 41.0, zoom: 4.0, bearing: -15, pitch: 20 },
  { longitude: -74.0, latitude: 40.71, zoom: 6.0, bearing: 30, pitch: 45 },
  { longitude: -98.5, latitude: 39.8, zoom: 3.2, bearing: 0, pitch: 0 },
];

export const CAMERA_PATH_DURATION_MS = 10_000;

// The bbox the synthetic data is scattered within (continental US).
export const DATA_BBOX = {
  west: -125,
  south: 24,
  east: -66,
  north: 49,
} as const;

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

// t in [0,1] over the whole path → linearly interpolated view state.
export function sampleCameraPath(t: number): ViewState {
  const segments = KEYFRAMES.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  const f = scaled - i;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  return {
    longitude: lerp(a.longitude, b.longitude, f),
    latitude: lerp(a.latitude, b.latitude, f),
    zoom: lerp(a.zoom, b.zoom, f),
    bearing: lerp(a.bearing, b.bearing, f),
    pitch: lerp(a.pitch, b.pitch, f),
  };
}
