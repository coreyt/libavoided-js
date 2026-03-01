/**
 * ConnEnd — connection endpoint matching libavoid's API.
 */

import type { Point } from '../types.js';
import { ConnDirFlag } from './enums.js';
import type { ShapeRef } from './shape-ref.js';

export class ConnEnd {
  private readonly _point: Point;
  private readonly _directions: ConnDirFlag;
  private readonly _shape: ShapeRef | undefined;
  private readonly _connectionPinClassId: number | undefined;

  /** Create an endpoint at a fixed point with optional direction constraint. */
  constructor(point: Point, directions?: ConnDirFlag);
  /** Create an endpoint attached to a shape's connection pin class. */
  constructor(shape: ShapeRef, connectionPinClassId: number);
  constructor(
    pointOrShape: Point | ShapeRef,
    directionsOrPin?: ConnDirFlag | number,
  ) {
    if (isPoint(pointOrShape)) {
      this._point = { x: pointOrShape.x, y: pointOrShape.y };
      this._directions = (directionsOrPin as ConnDirFlag) ?? ConnDirFlag.All;
      this._shape = undefined;
      this._connectionPinClassId = undefined;
    } else {
      this._shape = pointOrShape;
      this._connectionPinClassId = directionsOrPin as number;
      // Derive point from shape centre.
      const box = pointOrShape.polygon().boundingBox();
      this._point = {
        x: (box.min.x + box.max.x) / 2,
        y: (box.min.y + box.max.y) / 2,
      };
      this._directions = ConnDirFlag.All;
    }
  }

  /** The position of this endpoint. */
  point(): Point {
    return this._point;
  }

  /** Direction flags for this endpoint. */
  directions(): ConnDirFlag {
    return this._directions;
  }

  /** The shape this endpoint is attached to, if any. */
  shape(): ShapeRef | undefined {
    return this._shape;
  }

  /** The connection pin class ID, if attached to a shape. */
  connectionPinClassId(): number | undefined {
    return this._connectionPinClassId;
  }
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof (value as Point).x === 'number' &&
    typeof (value as Point).y === 'number'
  );
}
