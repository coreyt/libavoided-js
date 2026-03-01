import { describe, it, expect, beforeEach } from 'vitest';
import { ShapeRef, _resetShapeIdCounter } from '../../src/compat/shape-ref.js';
import { Rectangle, Polygon } from '../../src/compat/types.js';
import { Router } from '../../src/compat/router.js';
import { RouterFlag } from '../../src/compat/enums.js';

describe('ShapeRef', () => {
  let router: Router;

  beforeEach(() => {
    _resetShapeIdCounter();
    router = new Router(RouterFlag.OrthogonalRouting);
  });

  it('auto-generates an id', () => {
    const s1 = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    const s2 = new ShapeRef(router, new Rectangle({ x: 20, y: 20 }, { x: 30, y: 30 }));
    expect(s1.id()).not.toBe(s2.id());
  });

  it('accepts a manual id', () => {
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }), 42);
    expect(s.id()).toBe('42');
  });

  it('registers itself with the router on construction', () => {
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    expect(router.shapes().has(s)).toBe(true);
  });

  it('returns its polygon', () => {
    const rect = new Rectangle({ x: 5, y: 10 }, { x: 15, y: 20 });
    const s = new ShapeRef(router, rect);
    expect(s.polygon()).toBe(rect);
  });

  it('returns its router', () => {
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    expect(s.router()).toBe(router);
  });

  it('updates polygon with setNewPoly', () => {
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    const newPoly = new Rectangle({ x: 100, y: 100 }, { x: 200, y: 200 });
    s.setNewPoly(newPoly);
    expect(s.polygon()).toBe(newPoly);
  });

  it('transformConnectionPinPositions is a no-op', () => {
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    expect(() => s.transformConnectionPinPositions()).not.toThrow();
  });

  it('remove() unregisters from router', () => {
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    expect(router.shapes().has(s)).toBe(true);
    s.remove();
    expect(router.shapes().has(s)).toBe(false);
  });
});
