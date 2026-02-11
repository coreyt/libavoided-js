import { describe, it, expect } from 'vitest';
import { routeEdges } from '../src/router.js';
import type { Obstacle, EdgeRequest, RouterInput, Point } from '../src/types.js';

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  sx: number, sy: number,
  tx: number, ty: number,
  extras?: Partial<EdgeRequest>,
): EdgeRequest {
  return {
    id,
    sourceId,
    targetId,
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
    ...extras,
  };
}

describe('routeEdges', () => {
  it('returns empty edges for empty input', () => {
    const result = routeEdges({ obstacles: [], edges: [] });
    expect(result.edges).toEqual([]);
  });

  it('routes a single edge with no obstacles', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 0, 0, 100, 0)],
    };
    const result = routeEdges(input);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].id).toBe('e1');
    expect(result.edges[0].sections).toHaveLength(1);
    expect(result.edges[0].sections[0].startPoint).toEqual({ x: 0, y: 0 });
    expect(result.edges[0].sections[0].endPoint).toEqual({ x: 100, y: 0 });
    expect(result.edges[0].sections[0].incomingShape).toBe('A');
    expect(result.edges[0].sections[0].outgoingShape).toBe('B');
  });

  it('routes an edge around an obstacle', () => {
    const obstacles: Obstacle[] = [
      { id: 'obs1', x: 40, y: -20, width: 20, height: 40 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [makeEdge('e1', 'A', 'B', 0, 0, 100, 0)],
    };
    const result = routeEdges(input);

    expect(result.edges).toHaveLength(1);
    const section = result.edges[0].sections[0];
    // Should have bend points since it must route around the obstacle
    expect(section.bendPoints.length).toBeGreaterThan(0);
  });

  it('preserves pinned waypoints exactly', () => {
    const pinnedWaypoints: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];
    const input: RouterInput = {
      obstacles: [],
      edges: [
        makeEdge('e1', 'A', 'B', 0, 0, 100, 50, { pinnedWaypoints }),
      ],
    };
    const result = routeEdges(input);

    expect(result.edges).toHaveLength(1);
    const section = result.edges[0].sections[0];
    expect(section.startPoint).toEqual({ x: 0, y: 0 });
    expect(section.endPoint).toEqual({ x: 100, y: 50 });
    expect(section.bendPoints).toEqual(pinnedWaypoints);
  });

  it('routes multiple edges', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [
        makeEdge('e1', 'A', 'B', 0, 0, 100, 0),
        makeEdge('e2', 'A', 'C', 0, 0, 0, 100),
      ],
    };
    const result = routeEdges(input);

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].id).toBe('e1');
    expect(result.edges[1].id).toBe('e2');
  });

  it('handles source and target sharing same x (vertical straight line)', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 50, 0, 50, 100)],
    };
    const result = routeEdges(input);

    const section = result.edges[0].sections[0];
    // For a straight vertical path, there should be no bends
    // (or only collinear points that get merged)
    for (const bp of section.bendPoints) {
      expect(bp.x).toBe(50);
    }
  });

  it('handles source and target sharing same y (horizontal straight line)', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
    };
    const result = routeEdges(input);

    const section = result.edges[0].sections[0];
    for (const bp of section.bendPoints) {
      expect(bp.y).toBe(50);
    }
  });

  it('produces ELK-compatible sections shape', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'nodeA', 'nodeB', 0, 0, 100, 100)],
    };
    const result = routeEdges(input);

    const edge = result.edges[0];
    expect(edge).toHaveProperty('id');
    expect(edge).toHaveProperty('sections');
    expect(Array.isArray(edge.sections)).toBe(true);

    const section = edge.sections[0];
    expect(section).toHaveProperty('startPoint');
    expect(section).toHaveProperty('endPoint');
    expect(section).toHaveProperty('bendPoints');
    expect(section).toHaveProperty('incomingShape');
    expect(section).toHaveProperty('outgoingShape');
    expect(Array.isArray(section.bendPoints)).toBe(true);
  });

  it('accepts custom options', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 0, 0, 100, 100)],
    };
    const result = routeEdges(input, {
      obstacleMargin: 20,
      edgeSpacing: 12,
      bendPenalty: 100,
    });

    expect(result.edges).toHaveLength(1);
  });
});
