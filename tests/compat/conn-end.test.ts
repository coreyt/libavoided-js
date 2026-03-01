import { describe, it, expect, beforeEach } from 'vitest';
import { ConnEnd } from '../../src/compat/conn-end.js';
import { ConnDirFlag, RouterFlag } from '../../src/compat/enums.js';
import { Rectangle } from '../../src/compat/types.js';
import { ShapeRef, _resetShapeIdCounter } from '../../src/compat/shape-ref.js';
import { Router } from '../../src/compat/router.js';

describe('ConnEnd', () => {
  beforeEach(() => {
    _resetShapeIdCounter();
  });

  it('constructs from a point with default directions', () => {
    const end = new ConnEnd({ x: 10, y: 20 });
    expect(end.point()).toEqual({ x: 10, y: 20 });
    expect(end.directions()).toBe(ConnDirFlag.All);
    expect(end.shape()).toBeUndefined();
    expect(end.connectionPinClassId()).toBeUndefined();
  });

  it('constructs from a point with specific direction', () => {
    const end = new ConnEnd({ x: 5, y: 5 }, ConnDirFlag.Right);
    expect(end.point()).toEqual({ x: 5, y: 5 });
    expect(end.directions()).toBe(ConnDirFlag.Right);
  });

  it('constructs from a ShapeRef', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);
    const rect = new Rectangle({ x: 0, y: 0 }, { x: 100, y: 50 });
    const shape = new ShapeRef(router, rect);

    const end = new ConnEnd(shape, 1);
    expect(end.shape()).toBe(shape);
    expect(end.connectionPinClassId()).toBe(1);
    // Point should be the centre of the shape.
    expect(end.point()).toEqual({ x: 50, y: 25 });
    expect(end.directions()).toBe(ConnDirFlag.All);
  });

  it('copies the input point', () => {
    const pt = { x: 1, y: 2 };
    const end = new ConnEnd(pt);
    pt.x = 999;
    expect(end.point().x).toBe(1);
  });
});
