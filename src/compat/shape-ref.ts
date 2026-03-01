/**
 * ShapeRef — shape reference matching libavoid's API.
 */

import { Polygon } from './types.js';
import type { Router } from './router.js';

let nextShapeId = 1;

export class ShapeRef {
  private readonly _id: string;
  private _polygon: Polygon;
  private readonly _router: Router;

  constructor(router: Router, polygon: Polygon, id?: number) {
    this._id = String(id ?? nextShapeId++);
    this._polygon = polygon;
    this._router = router;
    router._addShape(this);
  }

  /** Unique identifier for this shape. */
  id(): string {
    return this._id;
  }

  /** The polygon defining this shape. */
  polygon(): Polygon {
    return this._polygon;
  }

  /** The router this shape belongs to. */
  router(): Router {
    return this._router;
  }

  /** Update the shape's polygon (e.g. after a move/resize). */
  setNewPoly(polygon: Polygon): void {
    this._polygon = polygon;
  }

  /** No-op stub — pin transforms are not supported. */
  transformConnectionPinPositions(): void {
    // Intentionally empty.
  }

  /** Remove this shape from its router. */
  remove(): void {
    this._router._removeShape(this);
  }
}

/** Reset the auto-ID counter (for testing). */
export function _resetShapeIdCounter(): void {
  nextShapeId = 1;
}
