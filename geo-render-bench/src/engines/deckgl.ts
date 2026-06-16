import { Deck } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import type { ViewState } from '../bench/camera';
import type { PointData } from '../data';
import type { Engine } from './types';

// deck.gl renders points as a single GPU draw call from binary attributes — no
// per-feature JS objects, so it scales to tens of millions of points.
export class DeckEngine implements Engine {
  readonly name = 'deck.gl';
  private deck: Deck | null = null;
  private firstPaint: (() => void) | null = null;

  mount(container: HTMLElement, initial: ViewState): Promise<void> {
    // Default view is a MapView; we omit an explicit `views` array so the view
    // state stays the single-view form the harness drives.
    this.deck = new Deck({
      parent: container as HTMLDivElement,
      controller: false,
      initialViewState: initial,
      layers: [],
      // Fires after every render; we latch it once to time the first data frame.
      onAfterRender: () => {
        if (this.firstPaint) {
          const done = this.firstPaint;
          this.firstPaint = null;
          done();
        }
      },
    });
    return Promise.resolve();
  }

  setData(data: PointData): Promise<void> {
    const deck = this.deck;
    if (!deck) throw new Error('deck not mounted');
    const layer = new ScatterplotLayer({
      id: 'points',
      data: {
        length: data.length,
        attributes: { getPosition: { value: data.positions, size: 2 } },
      },
      getFillColor: [137, 180, 250] as [number, number, number],
      getRadius: 1,
      radiusUnits: 'pixels',
      radiusMinPixels: 1.5,
      radiusMaxPixels: 3,
      stroked: false,
    });
    return new Promise((resolve) => {
      this.firstPaint = resolve;
      deck.setProps({ layers: [layer] });
    });
  }

  applyView(view: ViewState): void {
    this.deck?.setProps({ viewState: view });
  }

  destroy(): void {
    this.deck?.finalize();
    this.deck = null;
  }
}
