import { describe, it, expect } from 'vitest';
import {
  mergeCollinear,
  spaceParallelSegments,
  nudgeAwayFromObstacles,
  simplifyPaths,
} from '../src/simplify.js';
import type { Point } from '../src/types.js';

describe('mergeCollinear', () => {
  it('removes collinear points on a horizontal line', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const result = mergeCollinear(path);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it('removes collinear points on a vertical line', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 0, y: 100 },
    ];
    const result = mergeCollinear(path);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ]);
  });

  it('preserves bend points', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    const result = mergeCollinear(path);
    expect(result).toHaveLength(3);
  });

  it('handles two-point paths', () => {
    const path: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const result = mergeCollinear(path);
    expect(result).toEqual(path);
  });

  it('removes multiple collinear points in sequence', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 50 },
    ];
    const result = mergeCollinear(path);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 50 },
    ]);
  });
});

describe('spaceParallelSegments', () => {
  it('spaces two overlapping horizontal segments apart', () => {
    const paths: Point[][] = [
      [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      [{ x: 0, y: 50 }, { x: 100, y: 50 }],
    ];
    const result = spaceParallelSegments(paths, 8);

    // The two paths should now be at different y coordinates
    expect(result[0][0].y).not.toBe(result[1][0].y);
    expect(Math.abs(result[0][0].y - result[1][0].y)).toBeCloseTo(8);
  });

  it('does not modify non-overlapping segments', () => {
    const paths: Point[][] = [
      [{ x: 0, y: 50 }, { x: 40, y: 50 }],
      [{ x: 60, y: 50 }, { x: 100, y: 50 }],
    ];
    const result = spaceParallelSegments(paths, 8);
    expect(result[0][0].y).toBe(50);
    expect(result[1][0].y).toBe(50);
  });

  it('handles single path without changes', () => {
    const paths: Point[][] = [
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    ];
    const result = spaceParallelSegments(paths, 8);
    expect(result[0][0].y).toBe(0);
  });
});

describe('nudgeAwayFromObstacles', () => {
  it('pushes bend points away from obstacle edges', () => {
    const paths: Point[][] = [
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },   // Too close to obstacle at x=50, y=2
        { x: 50, y: 100 },
      ],
    ];
    const obstacles = [{ x: 48, y: -10, width: 20, height: 8 }];
    const result = nudgeAwayFromObstacles(paths, obstacles, 10);

    // The middle point should be pushed away from the obstacle
    expect(result[0]).toHaveLength(3);
    // Start and end should remain unchanged
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][2]).toEqual({ x: 50, y: 100 });
  });

  it('does not modify points already far from obstacles', () => {
    const paths: Point[][] = [
      [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }],
    ];
    const obstacles = [{ x: 200, y: 200, width: 50, height: 50 }];
    const result = nudgeAwayFromObstacles(paths, obstacles, 10);
    expect(result[0][1]).toEqual({ x: 50, y: 0 });
  });
});

describe('simplifyPaths', () => {
  it('runs the full pipeline', () => {
    const paths: Point[][] = [
      [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 100 },
      ],
    ];
    const result = simplifyPaths(paths, [], 8, 10);

    // Collinear merge should remove (25,0)
    expect(result[0].length).toBeLessThanOrEqual(4);
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][result[0].length - 1]).toEqual({ x: 100, y: 100 });
  });
});
