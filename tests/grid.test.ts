import { describe, it, expect } from 'vitest';
import { buildGrid, ensurePointInGrid } from '../src/grid.js';
import { pointKey } from '../src/geometry.js';
import type { Obstacle, EdgeRequest } from '../src/types.js';

function makeEdge(id: string, sx: number, sy: number, tx: number, ty: number): EdgeRequest {
  return {
    id,
    sourceId: 'src',
    targetId: 'tgt',
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
  };
}

describe('buildGrid', () => {
  it('creates vertices from a single obstacle', () => {
    const obstacles: Obstacle[] = [
      { id: 'A', x: 50, y: 50, width: 100, height: 60 },
    ];
    const edges = [makeEdge('e1', 30, 30, 200, 200)];
    const grid = buildGrid(obstacles, edges, 10);

    // Should have vertices, none inside the expanded obstacle
    expect(grid.vertices.size).toBeGreaterThan(0);

    const expandedRect = { x: 40, y: 40, width: 120, height: 80 };
    for (const [, v] of grid.vertices) {
      const p = v.point;
      const inside =
        p.x > expandedRect.x + 0.001 &&
        p.x < expandedRect.x + expandedRect.width - 0.001 &&
        p.y > expandedRect.y + 0.001 &&
        p.y < expandedRect.y + expandedRect.height - 0.001;
      expect(inside).toBe(false);
    }
  });

  it('includes edge anchor points as grid coordinates', () => {
    const obstacles: Obstacle[] = [];
    const edges = [makeEdge('e1', 25, 35, 175, 185)];
    const grid = buildGrid(obstacles, edges, 10);

    expect(grid.vertices.has(pointKey({ x: 25, y: 35 }))).toBe(true);
    expect(grid.vertices.has(pointKey({ x: 175, y: 185 }))).toBe(true);
  });

  it('creates midpoint channels between obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'A', x: 0, y: 0, width: 40, height: 40 },
      { id: 'B', x: 100, y: 0, width: 40, height: 40 },
    ];
    const edges = [makeEdge('e1', 45, 20, 95, 20)];
    const grid = buildGrid(obstacles, edges, 5);

    // There should be a midpoint x coordinate between the two expanded obstacle boundaries
    // A expanded: x=[-5, 45], B expanded: x=[95, 145]
    // Midpoint between 45 and 95 is 70
    const xCoords = new Set<number>();
    for (const [, v] of grid.vertices) xCoords.add(v.point.x);
    expect(xCoords.has(70)).toBe(true);
  });

  it('connects adjacent vertices horizontally', () => {
    const obstacles: Obstacle[] = [];
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid(obstacles, edges, 10);

    const srcKey = pointKey({ x: 0, y: 0 });
    const vertex = grid.vertices.get(srcKey);
    expect(vertex).toBeDefined();
    // Should have at least one neighbor on the same y-line
    let hasHorizNeighbor = false;
    for (const [nKey] of vertex!.neighbors) {
      const nv = grid.vertices.get(nKey);
      if (nv && nv.point.y === 0) hasHorizNeighbor = true;
    }
    expect(hasHorizNeighbor).toBe(true);
  });

  it('does not connect through obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'wall', x: 45, y: 0, width: 10, height: 100 },
    ];
    const edges = [makeEdge('e1', 0, 50, 100, 50)];
    const grid = buildGrid(obstacles, edges, 5);

    // Source and target should not be directly connected since obstacle is in between
    const srcKey = pointKey({ x: 0, y: 50 });
    const tgtKey = pointKey({ x: 100, y: 50 });

    const srcVertex = grid.vertices.get(srcKey);
    expect(srcVertex).toBeDefined();
    expect(srcVertex!.neighbors.has(tgtKey)).toBe(false);
  });

  it('handles empty obstacle list', () => {
    const edges = [makeEdge('e1', 0, 0, 50, 50)];
    const grid = buildGrid([], edges, 10);
    expect(grid.vertices.size).toBeGreaterThan(0);
  });

  it('adds previous path points to grid', () => {
    const edges: EdgeRequest[] = [
      {
        ...makeEdge('e1', 0, 0, 100, 100),
        previousPath: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }],
      },
    ];
    const grid = buildGrid([], edges, 10);
    expect(grid.vertices.has(pointKey({ x: 50, y: 0 }))).toBe(true);
    expect(grid.vertices.has(pointKey({ x: 50, y: 100 }))).toBe(true);
  });
});

describe('ensurePointInGrid', () => {
  it('adds a new point and connects it to existing grid', () => {
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid([], edges, 10);

    const newPoint = { x: 50, y: 0 };
    ensurePointInGrid(grid, newPoint);

    const key = pointKey(newPoint);
    expect(grid.vertices.has(key)).toBe(true);
    expect(grid.vertices.get(key)!.neighbors.size).toBeGreaterThan(0);
  });

  it('is a no-op for existing points', () => {
    const edges = [makeEdge('e1', 0, 0, 100, 0)];
    const grid = buildGrid([], edges, 10);

    const sizeBefore = grid.vertices.size;
    ensurePointInGrid(grid, { x: 0, y: 0 });
    expect(grid.vertices.size).toBe(sizeBefore);
  });
});
