import { describe, it, expect } from 'vitest';
import { routeEdges, routeEdgesIncremental } from '../src/index.js';
import type { RouterInput, EdgeRequest, Point } from '../src/types.js';

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

/**
 * Check that all segments in a path are axis-aligned (orthogonal).
 */
function isOrthogonal(path: Point[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    if (dx > 1e-9 && dy > 1e-9) return false;
  }
  return true;
}

/**
 * Check if any segment of path overlaps with an obstacle's interior.
 */
function pathIntersectsObstacle(
  path: Point[],
  obs: { x: number; y: number; width: number; height: number },
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    // Horizontal segment
    if (Math.abs(p1.y - p2.y) < 1e-9) {
      const y = p1.y;
      if (y > obs.y && y < obs.y + obs.height &&
          maxX > obs.x && minX < obs.x + obs.width) {
        return true;
      }
    }
    // Vertical segment
    if (Math.abs(p1.x - p2.x) < 1e-9) {
      const x = p1.x;
      if (x > obs.x && x < obs.x + obs.width &&
          maxY > obs.y && minY < obs.y + obs.height) {
        return true;
      }
    }
  }
  return false;
}

describe('Integration: Diamond graph (A→B, A→C, B→D, C→D)', () => {
  // Layout:
  //     A (100, 0, 80x40)
  //    / \
  //   B   C  (0,100,80x40) and (200,100,80x40)
  //    \ /
  //     D (100, 200, 80x40)
  const obstacles = [
    { id: 'A', x: 100, y: 0, width: 80, height: 40 },
    { id: 'B', x: 0, y: 100, width: 80, height: 40 },
    { id: 'C', x: 200, y: 100, width: 80, height: 40 },
    { id: 'D', x: 100, y: 200, width: 80, height: 40 },
  ];

  const input: RouterInput = {
    obstacles,
    edges: [
      makeEdge('AB', 'A', 'B', 100, 40, 40, 100),   // A bottom-left → B top-center
      makeEdge('AC', 'A', 'C', 180, 40, 240, 100),   // A bottom-right → C top-center
      makeEdge('BD', 'B', 'D', 40, 140, 140, 200),   // B bottom → D top-left
      makeEdge('CD', 'C', 'D', 240, 140, 180, 200),  // C bottom → D top-right
    ],
  };

  it('routes all 4 edges', () => {
    const result = routeEdges(input);
    expect(result.edges).toHaveLength(4);
  });

  it('produces orthogonal paths', () => {
    const result = routeEdges(input);
    for (const edge of result.edges) {
      const path = [
        edge.sections[0].startPoint,
        ...edge.sections[0].bendPoints,
        edge.sections[0].endPoint,
      ];
      expect(isOrthogonal(path)).toBe(true);
    }
  });

  it('paths do not pass through obstacle interiors', () => {
    const result = routeEdges(input);
    for (const edge of result.edges) {
      const path = [
        edge.sections[0].startPoint,
        ...edge.sections[0].bendPoints,
        edge.sections[0].endPoint,
      ];
      for (const obs of obstacles) {
        expect(pathIntersectsObstacle(path, obs)).toBe(false);
      }
    }
  });
});

describe('Integration: Pinned edge preserves user waypoints exactly', () => {
  it('uses pinned waypoints as the path without modification', () => {
    const pinnedWaypoints: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];

    const input: RouterInput = {
      obstacles: [{ id: 'obs1', x: 60, y: 10, width: 30, height: 30 }],
      edges: [
        makeEdge('e1', 'A', 'B', 0, 0, 100, 50, { pinnedWaypoints }),
      ],
    };

    const result = routeEdges(input);
    const section = result.edges[0].sections[0];

    // Pinned waypoints should be the bend points
    expect(section.bendPoints).toEqual(pinnedWaypoints);
    expect(section.startPoint).toEqual({ x: 0, y: 0 });
    expect(section.endPoint).toEqual({ x: 100, y: 50 });
  });
});

describe('Integration: Incremental routing stability', () => {
  it('returns same output when topology is unchanged', () => {
    const input: RouterInput = {
      obstacles: [
        { id: 'A', x: 40, y: -20, width: 20, height: 40 },
      ],
      edges: [makeEdge('e1', 'src', 'tgt', 0, 0, 100, 0)],
    };

    const result1 = routeEdges(input);
    const result2 = routeEdgesIncremental(input, input, result1);

    const path1 = [
      result1.edges[0].sections[0].startPoint,
      ...result1.edges[0].sections[0].bendPoints,
      result1.edges[0].sections[0].endPoint,
    ];
    const path2 = [
      result2.edges[0].sections[0].startPoint,
      ...result2.edges[0].sections[0].bendPoints,
      result2.edges[0].sections[0].endPoint,
    ];

    expect(path1).toEqual(path2);
  });
});

describe('Integration: ELK sections shape', () => {
  it('output matches ELK sections[] format', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'nodeA', 'nodeB', 0, 0, 100, 100)],
    };
    const result = routeEdges(input);

    const edge = result.edges[0];
    expect(edge.id).toBe('e1');
    expect(edge.sections).toBeInstanceOf(Array);
    expect(edge.sections).toHaveLength(1);

    const section = edge.sections[0];
    expect(section.startPoint).toHaveProperty('x');
    expect(section.startPoint).toHaveProperty('y');
    expect(section.endPoint).toHaveProperty('x');
    expect(section.endPoint).toHaveProperty('y');
    expect(section.bendPoints).toBeInstanceOf(Array);
    expect(section.incomingShape).toBe('nodeA');
    expect(section.outgoingShape).toBe('nodeB');
  });
});

describe('Integration: Edge cases', () => {
  it('nodes side-by-side — edge routes around', () => {
    // Two wide nodes next to each other, edge from left of A to right of B
    const obstacles = [
      { id: 'A', x: 0, y: 0, width: 100, height: 60 },
      { id: 'B', x: 120, y: 0, width: 100, height: 60 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [makeEdge('e1', 'A', 'B', 100, 30, 120, 30)],
    };
    const result = routeEdges(input);

    expect(result.edges).toHaveLength(1);
    const path = [
      result.edges[0].sections[0].startPoint,
      ...result.edges[0].sections[0].bendPoints,
      result.edges[0].sections[0].endPoint,
    ];
    expect(path[0]).toEqual({ x: 100, y: 30 });
    expect(path[path.length - 1]).toEqual({ x: 120, y: 30 });
  });

  it('source and target share x — vertical straight line, zero bends', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 50, 0, 50, 200)],
    };
    const result = routeEdges(input);

    const section = result.edges[0].sections[0];
    // All bend points should share x=50 (straight vertical)
    for (const bp of section.bendPoints) {
      expect(bp.x).toBe(50);
    }
  });

  it('source and target share y — horizontal straight line, zero bends', () => {
    const input: RouterInput = {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 0, 75, 300, 75)],
    };
    const result = routeEdges(input);

    const section = result.edges[0].sections[0];
    for (const bp of section.bendPoints) {
      expect(bp.y).toBe(75);
    }
  });

  it('edge crosses behind an obstacle', () => {
    // Obstacle between source and target, but offset so path must go around
    const obstacles = [
      { id: 'wall', x: 90, y: 20, width: 20, height: 60 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [makeEdge('e1', 'A', 'B', 50, 50, 150, 50)],
    };
    const result = routeEdges(input);

    expect(result.edges).toHaveLength(1);
    const path = [
      result.edges[0].sections[0].startPoint,
      ...result.edges[0].sections[0].bendPoints,
      result.edges[0].sections[0].endPoint,
    ];

    // Path should not pass through the obstacle
    expect(pathIntersectsObstacle(path, obstacles[0])).toBe(false);
    expect(isOrthogonal(path)).toBe(true);
  });
});
