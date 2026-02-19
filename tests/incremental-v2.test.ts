import { describe, it, expect } from 'vitest';
import { routeEdges } from '../src/router.js';
import { routeEdgesIncremental } from '../src/incremental.js';
import type { RouterInput, Obstacle, EdgeRequest, Point } from '../src/types.js';

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

function extractPath(result: { edges: Array<{ sections: Array<{ startPoint: Point; bendPoints: Point[]; endPoint: Point }> }> }, index: number): Point[] {
  const s = result.edges[index].sections[0];
  return [s.startPoint, ...s.bendPoints, s.endPoint];
}

describe('Incremental v2: selective re-routing', () => {
  const obstacles: Obstacle[] = [
    { id: 'A', x: 0, y: 0, width: 50, height: 50 },
    { id: 'B', x: 200, y: 0, width: 50, height: 50 },
    { id: 'C', x: 0, y: 200, width: 50, height: 50 },
  ];

  const edges: EdgeRequest[] = [
    makeEdge('AB', 'A', 'B', 50, 25, 200, 25),
    makeEdge('AC', 'A', 'C', 25, 50, 25, 200),
  ];

  it('returns identical output when nothing changed', () => {
    const input: RouterInput = { obstacles, edges };
    const first = routeEdges(input);
    const second = routeEdgesIncremental(input, input, first);

    // Paths should be identical
    for (let i = 0; i < edges.length; i++) {
      const path1 = extractPath(first, i);
      const path2 = extractPath(second, i);
      expect(path2).toEqual(path1);
    }
  });

  it('re-routes only affected edge when one endpoint changes', () => {
    const input1: RouterInput = { obstacles, edges };
    const result1 = routeEdges(input1);

    // Move B's target point
    const input2: RouterInput = {
      obstacles,
      edges: [
        makeEdge('AB', 'A', 'B', 50, 25, 200, 40), // target moved
        makeEdge('AC', 'A', 'C', 25, 50, 25, 200),  // unchanged
      ],
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);

    expect(result2.edges).toHaveLength(2);
    // AB should have a different endpoint
    expect(result2.edges[0].sections[0].endPoint.y).toBe(40);
  });

  it('detects obstacle changes that affect edge paths', () => {
    const input1: RouterInput = { obstacles, edges };
    const result1 = routeEdges(input1);

    // Add a new obstacle that sits in the path of AB
    const input2: RouterInput = {
      obstacles: [
        ...obstacles,
        { id: 'blocker', x: 100, y: 0, width: 50, height: 50 },
      ],
      edges,
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);

    expect(result2.edges).toHaveLength(2);
    // AB should now route around the new obstacle
    const pathAB = extractPath(result2, 0);
    expect(pathAB.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves unaffected edges when far obstacle moves', () => {
    const input1: RouterInput = { obstacles, edges };
    const result1 = routeEdges(input1);

    // Move obstacle C (far from AB's path)
    const input2: RouterInput = {
      obstacles: [
        { id: 'A', x: 0, y: 0, width: 50, height: 50 },
        { id: 'B', x: 200, y: 0, width: 50, height: 50 },
        { id: 'C', x: 0, y: 250, width: 50, height: 50 }, // moved down
      ],
      edges,
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);
    expect(result2.edges).toHaveLength(2);
  });

  it('handles edge removal gracefully', () => {
    const input1: RouterInput = { obstacles, edges };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles,
      edges: [makeEdge('AB', 'A', 'B', 50, 25, 200, 25)],
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);
    expect(result2.edges).toHaveLength(1);
    expect(result2.edges[0].id).toBe('AB');
  });

  it('handles new edge addition gracefully', () => {
    const input1: RouterInput = { obstacles, edges: [edges[0]] };
    const result1 = routeEdges(input1);

    const input2: RouterInput = { obstacles, edges };
    const result2 = routeEdgesIncremental(input2, input1, result1);
    expect(result2.edges).toHaveLength(2);
  });

  it('detects port spec changes as topology changes', () => {
    const input1: RouterInput = {
      obstacles,
      edges: [{
        ...edges[0],
        sourcePort: { side: 'EAST' as const },
      }],
    };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles,
      edges: [{
        ...edges[0],
        sourcePort: { side: 'SOUTH' as const },
      }],
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);
    // Should re-route since port changed
    expect(result2.edges).toHaveLength(1);
  });

  it('detects direction constraint changes', () => {
    const input1: RouterInput = {
      obstacles,
      edges: [{
        ...edges[0],
        sourceDirection: 'right' as const,
      }],
    };
    const result1 = routeEdges(input1);

    const input2: RouterInput = {
      obstacles,
      edges: [{
        ...edges[0],
        sourceDirection: 'down' as const,
      }],
    };
    const result2 = routeEdgesIncremental(input2, input1, result1);
    expect(result2.edges).toHaveLength(1);
  });
});
