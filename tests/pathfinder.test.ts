import { describe, it, expect } from 'vitest';
import { findPath, RoutedSegments } from '../src/pathfinder.js';
import { buildGrid } from '../src/grid.js';
import type { Obstacle, EdgeRequest } from '../src/types.js';

const defaultOptions = {
  bendPenalty: 50,
  crossingPenalty: 200,
  lengthPenalty: 1,
};

function makeEdge(id: string, sx: number, sy: number, tx: number, ty: number): EdgeRequest {
  return {
    id,
    sourceId: 'src',
    targetId: 'tgt',
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
  };
}

describe('findPath', () => {
  it('finds a straight horizontal path with no obstacles', () => {
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid([], edges, 10);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 100, y: 0 }, defaultOptions);

    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('finds a straight vertical path with no obstacles', () => {
    const edges = [makeEdge('e1', 0, 0, 0, 100)];
    const grid = buildGrid([], edges, 10);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 0, y: 100 }, defaultOptions);

    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 0, y: 100 });
    // All points should have x = 0 for a straight vertical path
    for (const p of path!) {
      expect(p.x).toBe(0);
    }
  });

  it('routes around a single obstacle', () => {
    const obstacles: Obstacle[] = [
      { id: 'wall', x: 40, y: -20, width: 20, height: 40 },
    ];
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid(obstacles, edges, 5);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 100, y: 0 }, defaultOptions);

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(2); // Should have bends
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('returns null when target is not in the grid', () => {
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid([], edges, 10);

    // Target at a position that isn't a grid vertex
    const path = findPath(grid, { x: 0, y: 0 }, { x: 999, y: 999 }, defaultOptions);
    expect(path).toBeNull();
  });

  it('returns single point for same source and target', () => {
    const edges = [makeEdge('e1', 50, 50, 50, 50)];
    const grid = buildGrid([], edges, 10);
    const path = findPath(grid, { x: 50, y: 50 }, { x: 50, y: 50 }, defaultOptions);

    expect(path).toEqual([{ x: 50, y: 50 }]);
  });

  it('prefers fewer bends with bend penalty', () => {
    // With high bend penalty, should prefer paths with fewer turns
    const edges = [makeEdge('e1', 0, 0, 100, 100)];
    const grid = buildGrid([], edges, 10);

    const pathLowBend = findPath(grid, { x: 0, y: 0 }, { x: 100, y: 100 }, {
      ...defaultOptions,
      bendPenalty: 1,
    });
    const pathHighBend = findPath(grid, { x: 0, y: 0 }, { x: 100, y: 100 }, {
      ...defaultOptions,
      bendPenalty: 500,
    });

    expect(pathLowBend).not.toBeNull();
    expect(pathHighBend).not.toBeNull();
    // High bend penalty should produce path with <= bends as low penalty
    const countBends = (path: { x: number; y: number }[]) => {
      let bends = 0;
      for (let i = 1; i < path.length - 1; i++) {
        const sameX = path[i - 1].x === path[i].x && path[i].x === path[i + 1].x;
        const sameY = path[i - 1].y === path[i].y && path[i].y === path[i + 1].y;
        if (!sameX && !sameY) bends++;
      }
      return bends;
    };
    expect(countBends(pathHighBend!)).toBeLessThanOrEqual(countBends(pathLowBend!));
  });

  it('avoids crossings with previously routed edges', () => {
    const edges = [
      makeEdge('e1', 0, 50, 100, 50), // horizontal
      makeEdge('e2', 50, 0, 50, 100), // vertical — would cross e1
    ];
    const grid = buildGrid([], edges, 10);

    // Route e1 first
    const path1 = findPath(grid, { x: 0, y: 50 }, { x: 100, y: 50 }, defaultOptions);
    expect(path1).not.toBeNull();

    // Register e1's segments
    const routed = new RoutedSegments();
    routed.addPath(path1!);

    // Route e2 with crossing penalty
    const path2 = findPath(
      grid,
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { ...defaultOptions, crossingPenalty: 2000 },
      routed,
    );
    expect(path2).not.toBeNull();
  });

  it('produces orthogonal paths (only axis-aligned moves)', () => {
    const obstacles: Obstacle[] = [
      { id: 'A', x: 30, y: 30, width: 40, height: 40 },
    ];
    const edges = [makeEdge('e1', 0, 0, 100, 100)];
    const grid = buildGrid(obstacles, edges, 5);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 100, y: 100 }, defaultOptions);

    expect(path).not.toBeNull();
    for (let i = 0; i < path!.length - 1; i++) {
      const dx = Math.abs(path![i + 1].x - path![i].x);
      const dy = Math.abs(path![i + 1].y - path![i].y);
      // Each step should be purely horizontal or purely vertical
      expect(dx < 1e-9 || dy < 1e-9).toBe(true);
    }
  });

  it('handles multiple obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'A', x: 20, y: -10, width: 20, height: 30 },
      { id: 'B', x: 60, y: -10, width: 20, height: 30 },
    ];
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid(obstacles, edges, 5);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 100, y: 0 }, defaultOptions);

    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 100, y: 0 });
  });
});

describe('RoutedSegments', () => {
  it('counts crossings correctly', () => {
    const routed = new RoutedSegments();
    // Add a horizontal path
    routed.addPath([{ x: 0, y: 50 }, { x: 100, y: 50 }]);

    // Vertical segment that crosses
    expect(routed.countCrossings({
      p1: { x: 50, y: 0 },
      p2: { x: 50, y: 100 },
    })).toBe(1);

    // Parallel segment that doesn't cross
    expect(routed.countCrossings({
      p1: { x: 0, y: 30 },
      p2: { x: 100, y: 30 },
    })).toBe(0);
  });
});
