import { describe, it, expect } from 'vitest';
import { Polygon, PolyLine, Rectangle } from '../../src/compat/types.js';

describe('Polygon', () => {
  it('constructs with no arguments', () => {
    const p = new Polygon();
    expect(p.ps).toEqual([]);
    expect(p.size()).toBe(0);
  });

  it('constructs with points', () => {
    const p = new Polygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(p.size()).toBe(3);
  });

  it('copies input array', () => {
    const pts = [{ x: 1, y: 2 }];
    const p = new Polygon(pts);
    pts.push({ x: 3, y: 4 });
    expect(p.size()).toBe(1);
  });

  it('computes bounding box', () => {
    const p = new Polygon([
      { x: 5, y: 10 },
      { x: 20, y: 3 },
      { x: 15, y: 25 },
    ]);
    const box = p.boundingBox();
    expect(box.min).toEqual({ x: 5, y: 3 });
    expect(box.max).toEqual({ x: 20, y: 25 });
  });

  it('returns zero box for empty polygon', () => {
    const box = new Polygon().boundingBox();
    expect(box.min).toEqual({ x: 0, y: 0 });
    expect(box.max).toEqual({ x: 0, y: 0 });
  });
});

describe('PolyLine', () => {
  it('is a Polygon', () => {
    const pl = new PolyLine([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(pl).toBeInstanceOf(Polygon);
    expect(pl.size()).toBe(2);
  });
});

describe('Rectangle', () => {
  it('creates four-point polygon from two corners', () => {
    const r = new Rectangle({ x: 10, y: 20 }, { x: 50, y: 60 });
    expect(r.size()).toBe(4);
    expect(r.ps).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 60 },
      { x: 10, y: 60 },
    ]);
  });

  it('is a Polygon', () => {
    const r = new Rectangle({ x: 0, y: 0 }, { x: 1, y: 1 });
    expect(r).toBeInstanceOf(Polygon);
  });

  it('computes correct bounding box', () => {
    const r = new Rectangle({ x: 10, y: 20 }, { x: 50, y: 60 });
    const box = r.boundingBox();
    expect(box.min).toEqual({ x: 10, y: 20 });
    expect(box.max).toEqual({ x: 50, y: 60 });
  });
});
