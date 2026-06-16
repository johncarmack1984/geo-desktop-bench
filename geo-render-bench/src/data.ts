import { DATA_BBOX } from './bench/camera';

// Seeded PRNG (mulberry32) so a given (count, seed) is byte-for-byte reproducible
// across runs and engines — no Math.random drift between deck.gl and MapLibre.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Minimal GeoJSON shape — defined locally so we don't take a hard dep on the
// 'geojson' types; cast to MapLibre's expected type at the call site.
interface GeoJSONPoint {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: null;
}
export interface GeoJSONFC {
  type: 'FeatureCollection';
  features: GeoJSONPoint[];
}

export interface PointData {
  readonly length: number;
  // Interleaved [lng, lat] pairs in Float32 — deck.gl's binary attribute fast path.
  readonly positions: Float32Array;
  // Built lazily (and expensively) only when an engine needs object GeoJSON.
  toGeoJSON(): GeoJSONFC;
}

export function makePoints(count: number, seed = 1): PointData {
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 2);
  const { west, south, east, north } = DATA_BBOX;
  const lngSpan = east - west;
  const latSpan = north - south;
  for (let i = 0; i < count; i++) {
    // 60% of points cluster toward the center, 40% spread uniformly — closer to
    // real point data than pure noise, and gives the tiler something to chew on.
    const jitter = rng() < 0.6 ? 0.12 : 1.0;
    positions[i * 2] = west + (rng() * jitter + (1 - jitter) * 0.5) * lngSpan;
    positions[i * 2 + 1] =
      south + (rng() * jitter + (1 - jitter) * 0.5) * latSpan;
  }
  return {
    length: count,
    positions,
    toGeoJSON(): GeoJSONFC {
      const features = new Array<GeoJSONPoint>(count);
      for (let i = 0; i < count; i++) {
        features[i] = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [positions[i * 2], positions[i * 2 + 1]],
          },
          properties: null,
        };
      }
      return { type: 'FeatureCollection', features };
    },
  };
}
