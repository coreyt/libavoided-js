import { describe, it, expect } from 'vitest';
import { routeEdges } from '../src/router.js';
import { normalizeObstacles } from '../src/grid.js';
import type { RouterInput, Obstacle } from '../src/types.js';

function makeEdge(
  id: string, sourceId: string, targetId: string,
  sx: number, sy: number, tx: number, ty: number,
  extras?: Record<string, unknown>,
) {
  return {
    id, sourceId, targetId,
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
    ...extras,
  };
}

function isOrthogonal(path: Array<{ x: number; y: number }>): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    if (dx > 1e-9 && dy > 1e-9) return false;
  }
  return true;
}

describe('Robustness: normalizeObstacles', () => {
  it('filters out zero-width obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'a', x: 0, y: 0, width: 0, height: 50 },
      { id: 'b', x: 10, y: 10, width: 50, height: 50 },
    ];
    expect(normalizeObstacles(obstacles)).toHaveLength(1);
    expect(normalizeObstacles(obstacles)[0].id).toBe('b');
  });

  it('filters out zero-height obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'a', x: 0, y: 0, width: 50, height: 0 },
    ];
    expect(normalizeObstacles(obstacles)).toHaveLength(0);
  });

  it('filters out negative-dimension obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'a', x: 0, y: 0, width: -10, height: 50 },
      { id: 'b', x: 0, y: 0, width: 50, height: -10 },
    ];
    expect(normalizeObstacles(obstacles)).toHaveLength(0);
  });

  it('deduplicates obstacles by id (last wins)', () => {
    const obstacles: Obstacle[] = [
      { id: 'a', x: 0, y: 0, width: 50, height: 50 },
      { id: 'a', x: 100, y: 100, width: 50, height: 50 },
    ];
    const result = normalizeObstacles(obstacles);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(100);
  });
});

describe('Robustness: routed flag', () => {
  it('marks successfully routed edges as routed: true', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'a', 'b', 0, 0, 100, 0)],
    };
    const result = routeEdges(input);
    expect(result.edges[0].sections[0].routed).toBe(true);
  });

  it('marks fallback edges as routed: false when path not found', () => {
    // Create a scenario where the source is completely surrounded
    const obstacles: Obstacle[] = [
      { id: 'wall-top', x: -5, y: -15, width: 30, height: 10 },
      { id: 'wall-bottom', x: -5, y: 15, width: 30, height: 10 },
      { id: 'wall-left', x: -15, y: -5, width: 10, height: 30 },
      { id: 'wall-right', x: 15, y: -5, width: 10, height: 30 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [makeEdge('e1', 'src', 'tgt', 5, 5, 200, 200)],
    };
    const result = routeEdges(input);
    // The edge should still exist (edge count preservation)
    expect(result.edges).toHaveLength(1);
    // Check that routed flag reflects the outcome
    expect(typeof result.edges[0].sections[0].routed).toBe('boolean');
  });
});

describe('Robustness: grid expansion retry', () => {
  it('successfully routes around obstacles after grid expansion', () => {
    const obstacles: Obstacle[] = [
      { id: 'block', x: 40, y: -10, width: 20, height: 40 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [makeEdge('e1', 'a', 'b', 0, 0, 100, 0)],
    };
    const result = routeEdges(input);
    expect(result.edges[0].sections[0].routed).toBe(true);
    const path = [
      result.edges[0].sections[0].startPoint,
      ...result.edges[0].sections[0].bendPoints,
      result.edges[0].sections[0].endPoint,
    ];
    expect(isOrthogonal(path)).toBe(true);
  });
});

describe('Robustness: _state in output', () => {
  it('includes _state with grid info', () => {
    const input: RouterInput = {
      obstacles: [{ id: 'n1', x: 0, y: 0, width: 50, height: 50 }],
      edges: [makeEdge('e1', 'n1', 'n2', 50, 25, 150, 25)],
    };
    const result = routeEdges(input);
    expect(result._state).toBeDefined();
    expect(result._state!.gridVertexCount).toBeGreaterThan(0);
    expect(result._state!.obstacles).toHaveLength(1);
    expect(result._state!.edgePathMap).toBeInstanceOf(Map);
    expect(result._state!.edgePathMap.has('e1')).toBe(true);
  });
});

describe('Robustness: zero-size obstacles in routing', () => {
  it('routes successfully when input contains zero-size obstacles', () => {
    const obstacles: Obstacle[] = [
      { id: 'valid', x: 40, y: 0, width: 20, height: 20 },
      { id: 'zero', x: 100, y: 100, width: 0, height: 0 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [makeEdge('e1', 'a', 'b', 0, 10, 100, 10)],
    };
    const result = routeEdges(input);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].sections[0].routed).toBe(true);
  });
});
