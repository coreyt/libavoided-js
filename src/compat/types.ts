/**
 * Geometric types matching libavoid's C++ API.
 */

import type { Point } from '../types.js';

/** A polygon represented as a sequence of vertices. */
export class Polygon {
  readonly ps: Point[];

  constructor(points?: Point[]) {
    this.ps = points ? [...points] : [];
  }

  /** Number of vertices. */
  size(): number {
    return this.ps.length;
  }

  /** Axis-aligned bounding box. */
  boundingBox(): Box {
    if (this.ps.length === 0) {
      return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of this.ps) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
  }
}

/** A routed polyline path. */
export class PolyLine extends Polygon {
  constructor(points?: Point[]) {
    super(points);
  }
}

/** An axis-aligned rectangle, constructed from two corner points. */
export class Rectangle extends Polygon {
  constructor(topLeft: Point, bottomRight: Point) {
    super([
      { x: topLeft.x, y: topLeft.y },
      { x: bottomRight.x, y: topLeft.y },
      { x: bottomRight.x, y: bottomRight.y },
      { x: topLeft.x, y: bottomRight.y },
    ]);
  }
}

/** Axis-aligned bounding box with min/max corners. */
export interface Box {
  min: Point;
  max: Point;
}

/** A checkpoint that a connector route should pass through. */
export interface Checkpoint {
  point: Point;
}
