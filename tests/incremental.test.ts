import { describe, it, expect } from 'vitest';
import { routeEdgesIncremental } from '../src/incremental.js';
import { routeEdges } from '../src/router.js';
import type { RouterInput, RouterOutput, EdgeRequest, Point } from '../src/types.js';

function makeEdge(
  id: string,
  sx: number, sy: number,
  tx: number, ty: number,
): EdgeRequest {
  return {
    id,
    sourceId: `src-${id}`,
    targetId: `tgt-${id}`,
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
  };
}

describe('routeEdgesIncremental', () => {
  it('falls back to full routing when no previous data', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 0, 0, 100, 0)],
    };

    const result = routeEdgesIncremental(input, null, null);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].id).toBe('e1');
  });

  it('produces same output for unchanged topology', () => {
    const input: RouterInput = {
      obstacles: [{ id: 'obs1', x: 40, y: -20, width: 20, height: 40 }],
      edges: [makeEdge('e1', 0, 0, 100, 0)],
    };

    const firstResult = routeEdges(input);

    // Run incremental with same input
    const incrementalResult = routeEdgesIncremental(input, input, firstResult);

    expect(incrementalResult.edges).toHaveLength(1);
    expect(incrementalResult.edges[0].sections[0].startPoint).toEqual(
      firstResult.edges[0].sections[0].startPoint,
    );
    expect(incrementalResult.edges[0].sections[0].endPoint).toEqual(
      firstResult.edges[0].sections[0].endPoint,
    );
  });

  it('re-routes when endpoints change', () => {
    const input1: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 0, 0, 100, 0)],
    };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 0, 0, 200, 0)], // Different target
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);

    expect(result2.edges).toHaveLength(1);
    expect(result2.edges[0].sections[0].endPoint).toEqual({ x: 200, y: 0 });
  });

  it('re-routes when obstacles change', () => {
    const input1: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 0, 0, 100, 0)],
    };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles: [{ id: 'new-obs', x: 40, y: -20, width: 20, height: 40 }],
      edges: [makeEdge('e1', 0, 0, 100, 0)],
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);

    expect(result2.edges).toHaveLength(1);
    // Should have bend points since there's now an obstacle
    expect(result2.edges[0].sections[0].bendPoints.length).toBeGreaterThan(0);
  });

  it('handles new edges not in previous result', () => {
    const input1: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 0, 0, 100, 0)],
    };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles: [],
      edges: [
        makeEdge('e1', 0, 0, 100, 0),
        makeEdge('e2', 0, 0, 0, 100), // New edge
      ],
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);

    expect(result2.edges).toHaveLength(2);
    expect(result2.edges[1].id).toBe('e2');
  });

  it('handles removed edges', () => {
    const input1: RouterInput = {
      obstacles: [],
      edges: [
        makeEdge('e1', 0, 0, 100, 0),
        makeEdge('e2', 0, 0, 0, 100),
      ],
    };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 0, 0, 100, 0)], // e2 removed
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);

    expect(result2.edges).toHaveLength(1);
    expect(result2.edges[0].id).toBe('e1');
  });
});
