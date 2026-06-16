import type { ViewState } from '../bench/camera';
import type { PointData } from '../data';

// A renderer the harness can drive identically. Keep this surface tiny so the
// only thing that differs between runs is the engine itself.
export interface Engine {
  readonly name: string;
  mount(container: HTMLElement, initial: ViewState): Promise<void>;
  // Resolves once the data has produced its first settled frame (≈ time-to-first-render).
  setData(data: PointData): Promise<void>;
  // Called every animation frame to drive the scripted camera.
  applyView(view: ViewState): void;
  destroy(): void;
}
