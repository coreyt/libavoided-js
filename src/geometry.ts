import type { Point, Rect, Segment } from './types.js';

const EPSILON = 1e-9;

export function pointEquals(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclideanDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  };
}

export function pointInRect(p: Point, rect: Rect): boolean {
  return (
    p.x > rect.x + EPSILON &&
    p.x < rect.x + rect.width - EPSILON &&
    p.y > rect.y + EPSILON &&
    p.y < rect.y + rect.height - EPSILON
  );
}

export function pointOnRectBorder(p: Point, rect: Rect): boolean {
  const onVerticalEdge =
    (Math.abs(p.x - rect.x) < EPSILON || Math.abs(p.x - (rect.x + rect.width)) < EPSILON) &&
    p.y >= rect.y - EPSILON &&
    p.y <= rect.y + rect.height + EPSILON;
  const onHorizontalEdge =
    (Math.abs(p.y - rect.y) < EPSILON || Math.abs(p.y - (rect.y + rect.height)) < EPSILON) &&
    p.x >= rect.x - EPSILON &&
    p.x <= rect.x + rect.width + EPSILON;
  return onVerticalEdge || onHorizontalEdge;
}

/**
 * Check if a horizontal or vertical segment intersects with a rectangle's interior.
 * Returns true if any part of the segment passes through the rect (not just touching the border).
 */
export function segmentIntersectsRect(seg: Segment, rect: Rect): boolean {
  const { p1, p2 } = seg;
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const rLeft = rect.x;
  const rRight = rect.x + rect.width;
  const rTop = rect.y;
  const rBottom = rect.y + rect.height;

  // Horizontal segment
  if (Math.abs(p1.y - p2.y) < EPSILON) {
    const y = p1.y;
    if (y <= rTop + EPSILON || y >= rBottom - EPSILON) return false;
    if (maxX <= rLeft + EPSILON || minX >= rRight - EPSILON) return false;
    return true;
  }

  // Vertical segment
  if (Math.abs(p1.x - p2.x) < EPSILON) {
    const x = p1.x;
    if (x <= rLeft + EPSILON || x >= rRight - EPSILON) return false;
    if (maxY <= rTop + EPSILON || minY >= rBottom - EPSILON) return false;
    return true;
  }

  // General segment (diagonal) — simplified AABB check
  if (maxX <= rLeft + EPSILON || minX >= rRight - EPSILON) return false;
  if (maxY <= rTop + EPSILON || minY >= rBottom - EPSILON) return false;
  return true;
}

/**
 * Check if two orthogonal segments cross each other at a single interior point.
 * One must be horizontal, the other vertical.
 */
export function orthogonalSegmentsCross(a: Segment, b: Segment): boolean {
  const aHoriz = Math.abs(a.p1.y - a.p2.y) < EPSILON;
  const bHoriz = Math.abs(b.p1.y - b.p2.y) < EPSILON;

  // Both same orientation — parallel, can't cross
  if (aHoriz === bHoriz) return false;

  const horiz = aHoriz ? a : b;
  const vert = aHoriz ? b : a;

  const hY = horiz.p1.y;
  const hMinX = Math.min(horiz.p1.x, horiz.p2.x);
  const hMaxX = Math.max(horiz.p1.x, horiz.p2.x);

  const vX = vert.p1.x;
  const vMinY = Math.min(vert.p1.y, vert.p2.y);
  const vMaxY = Math.max(vert.p1.y, vert.p2.y);

  // Strict interior crossing — not at endpoints
  return (
    vX > hMinX + EPSILON &&
    vX < hMaxX - EPSILON &&
    hY > vMinY + EPSILON &&
    hY < vMaxY - EPSILON
  );
}

/**
 * Compute distance from a point to the nearest edge of a rectangle.
 * Returns 0 if the point is inside the rect.
 */
export function distanceToRect(p: Point, rect: Rect): number {
  const cx = Math.max(rect.x, Math.min(p.x, rect.x + rect.width));
  const cy = Math.max(rect.y, Math.min(p.y, rect.y + rect.height));
  return euclideanDistance(p, { x: cx, y: cy });
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

export function parsePointKey(key: string): Point {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * Check if three points are collinear (all share same x or same y for orthogonal paths).
 */
export function areCollinear(a: Point, b: Point, c: Point): boolean {
  const sameX = Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON;
  const sameY = Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON;
  return sameX || sameY;
}
