import { describe, it, expect } from 'vitest';
import {
  pointEquals,
  manhattanDistance,
  euclideanDistance,
  expandRect,
  pointInRect,
  pointOnRectBorder,
  segmentIntersectsRect,
  orthogonalSegmentsCross,
  distanceToRect,
  areCollinear,
  pointKey,
  parsePointKey,
} from '../src/geometry.js';

describe('pointEquals', () => {
  it('returns true for identical points', () => {
    expect(pointEquals({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
  });

  it('returns false for different points', () => {
    expect(pointEquals({ x: 1, y: 2 }, { x: 3, y: 2 })).toBe(false);
  });

  it('handles floating-point near-equality', () => {
    expect(pointEquals({ x: 1, y: 2 }, { x: 1 + 1e-10, y: 2 })).toBe(true);
  });
});

describe('manhattanDistance', () => {
  it('computes correct distance', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it('returns 0 for same point', () => {
    expect(manhattanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('euclideanDistance', () => {
  it('computes correct distance for 3-4-5 triangle', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('expandRect', () => {
  it('expands rectangle by margin', () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 };
    const expanded = expandRect(rect, 5);
    expect(expanded).toEqual({ x: 5, y: 15, width: 110, height: 60 });
  });
});

describe('pointInRect', () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };

  it('returns true for interior point', () => {
    expect(pointInRect({ x: 50, y: 25 }, rect)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(pointInRect({ x: 150, y: 25 }, rect)).toBe(false);
  });

  it('returns false for point on border', () => {
    expect(pointInRect({ x: 0, y: 25 }, rect)).toBe(false);
  });
});

describe('pointOnRectBorder', () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };

  it('returns true for point on left edge', () => {
    expect(pointOnRectBorder({ x: 0, y: 25 }, rect)).toBe(true);
  });

  it('returns true for point on bottom edge', () => {
    expect(pointOnRectBorder({ x: 50, y: 50 }, rect)).toBe(true);
  });

  it('returns false for interior point', () => {
    expect(pointOnRectBorder({ x: 50, y: 25 }, rect)).toBe(false);
  });
});

describe('segmentIntersectsRect', () => {
  const rect = { x: 10, y: 10, width: 80, height: 40 };

  it('horizontal segment through rect', () => {
    expect(segmentIntersectsRect({ p1: { x: 0, y: 30 }, p2: { x: 100, y: 30 } }, rect)).toBe(true);
  });

  it('horizontal segment above rect', () => {
    expect(segmentIntersectsRect({ p1: { x: 0, y: 5 }, p2: { x: 100, y: 5 } }, rect)).toBe(false);
  });

  it('vertical segment through rect', () => {
    expect(segmentIntersectsRect({ p1: { x: 50, y: 0 }, p2: { x: 50, y: 60 } }, rect)).toBe(true);
  });

  it('vertical segment left of rect', () => {
    expect(segmentIntersectsRect({ p1: { x: 5, y: 0 }, p2: { x: 5, y: 60 } }, rect)).toBe(false);
  });

  it('segment touching rect border (not intersecting)', () => {
    expect(segmentIntersectsRect({ p1: { x: 0, y: 10 }, p2: { x: 100, y: 10 } }, rect)).toBe(false);
  });
});

describe('orthogonalSegmentsCross', () => {
  it('returns true for crossing segments', () => {
    const a = { p1: { x: 0, y: 5 }, p2: { x: 10, y: 5 } };
    const b = { p1: { x: 5, y: 0 }, p2: { x: 5, y: 10 } };
    expect(orthogonalSegmentsCross(a, b)).toBe(true);
  });

  it('returns false for parallel segments', () => {
    const a = { p1: { x: 0, y: 5 }, p2: { x: 10, y: 5 } };
    const b = { p1: { x: 0, y: 8 }, p2: { x: 10, y: 8 } };
    expect(orthogonalSegmentsCross(a, b)).toBe(false);
  });

  it('returns false for T-junction (endpoint touching)', () => {
    const a = { p1: { x: 0, y: 5 }, p2: { x: 10, y: 5 } };
    const b = { p1: { x: 10, y: 0 }, p2: { x: 10, y: 10 } };
    expect(orthogonalSegmentsCross(a, b)).toBe(false);
  });

  it('returns false for non-overlapping segments', () => {
    const a = { p1: { x: 0, y: 5 }, p2: { x: 3, y: 5 } };
    const b = { p1: { x: 5, y: 0 }, p2: { x: 5, y: 10 } };
    expect(orthogonalSegmentsCross(a, b)).toBe(false);
  });
});

describe('distanceToRect', () => {
  const rect = { x: 10, y: 10, width: 80, height: 40 };

  it('returns 0 for point inside rect', () => {
    expect(distanceToRect({ x: 50, y: 30 }, rect)).toBe(0);
  });

  it('computes distance to nearest edge', () => {
    expect(distanceToRect({ x: 5, y: 30 }, rect)).toBe(5);
  });
});

describe('areCollinear', () => {
  it('returns true for three points on same horizontal line', () => {
    expect(areCollinear({ x: 0, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 5 })).toBe(true);
  });

  it('returns true for three points on same vertical line', () => {
    expect(areCollinear({ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 10 })).toBe(true);
  });

  it('returns false for non-collinear points', () => {
    expect(areCollinear({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 })).toBe(false);
  });
});

describe('pointKey / parsePointKey', () => {
  it('roundtrips correctly', () => {
    const p = { x: 42, y: -17 };
    expect(parsePointKey(pointKey(p))).toEqual(p);
  });
});
