import { describe, it, expect, beforeAll } from 'vitest';
import { routeEdges } from '../src/index.js';
import type { RouterInput, RouterOutput, EdgeRequest, Point, Obstacle } from '../src/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function extractPath(output: RouterOutput, index: number): Point[] {
  const s = output.edges[index].sections[0];
  return [s.startPoint, ...s.bendPoints, s.endPoint];
}

function isOrthogonal(path: Point[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    if (dx > 1e-9 && dy > 1e-9) return false;
  }
  return true;
}

function pathIntersectsObstacle(
  path: Point[],
  obs: Obstacle,
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

function getSegmentDirection(from: Point, to: Point): 'up' | 'down' | 'left' | 'right' | 'none' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 'none';
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

interface Fixture {
  name: string;
  input: RouterInput;
  hasPinnedEdges: boolean;
  hasDirectionConstraints: boolean;
}

const fixtures: Fixture[] = [
  {
    name: 'no-obstacles-horizontal',
    input: {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'no-obstacles-vertical',
    input: {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 50, 0, 50, 200)],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'no-obstacles-diagonal-endpoints',
    input: {
      obstacles: [],
      edges: [makeEdge('e1', 'A', 'B', 0, 0, 100, 100)],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'single-obstacle-in-path',
    input: {
      obstacles: [{ id: 'obs1', x: 80, y: 20, width: 40, height: 60 }],
      edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'multiple-obstacles-corridor',
    input: {
      obstacles: [
        { id: 'obs1', x: 60, y: 0, width: 30, height: 40 },
        { id: 'obs2', x: 60, y: 60, width: 30, height: 40 },
        { id: 'obs3', x: 130, y: 20, width: 30, height: 60 },
      ],
      edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'adjacent-obstacles-narrow-gap',
    input: {
      obstacles: [
        { id: 'obs1', x: 80, y: 0, width: 40, height: 37 },
        { id: 'obs2', x: 80, y: 62, width: 40, height: 38 },
      ],
      edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'multiple-edges-shared-source',
    input: {
      obstacles: [{ id: 'obs1', x: 140, y: 60, width: 40, height: 40 }],
      edges: [
        makeEdge('e1', 'A', 'B', 100, 0, 100, 200),
        makeEdge('e2', 'A', 'C', 200, 0, 200, 200),
        makeEdge('e3', 'A', 'D', 300, 0, 300, 200),
      ],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'pinned-edge-mixed',
    input: {
      obstacles: [{ id: 'obs1', x: 80, y: 20, width: 40, height: 60 }],
      edges: [
        makeEdge('e1', 'A', 'B', 0, 50, 200, 50, {
          pinnedWaypoints: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        }),
        makeEdge('e2', 'A', 'C', 0, 50, 200, 100),
      ],
    },
    hasPinnedEdges: true,
    hasDirectionConstraints: false,
  },
  {
    name: 'diamond-graph',
    input: {
      obstacles: [
        { id: 'A', x: 100, y: 0, width: 80, height: 40 },
        { id: 'B', x: 0, y: 100, width: 80, height: 40 },
        { id: 'C', x: 200, y: 100, width: 80, height: 40 },
        { id: 'D', x: 100, y: 200, width: 80, height: 40 },
      ],
      edges: [
        makeEdge('AB', 'A', 'B', 100, 40, 40, 100),
        makeEdge('AC', 'A', 'C', 180, 40, 240, 100),
        makeEdge('BD', 'B', 'D', 40, 140, 140, 200),
        makeEdge('CD', 'C', 'D', 240, 140, 180, 200),
      ],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: false,
  },
  {
    name: 'direction-constrained',
    input: {
      obstacles: [
        { id: 'obs1', x: 80, y: 20, width: 40, height: 60 },
        { id: 'obs2', x: 80, y: 120, width: 40, height: 60 },
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 0, 50, 200, 50, {
          sourceDirection: 'right',
          targetDirection: 'right',
        }),
        makeEdge('e2', 'C', 'D', 100, 100, 100, 200, {
          sourceDirection: 'down',
          targetDirection: 'down',
        }),
      ],
    },
    hasPinnedEdges: false,
    hasDirectionConstraints: true,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

for (const fixture of fixtures) {
  describe(`Property: ${fixture.name}`, () => {
    let result: RouterOutput;

    beforeAll(() => {
      result = routeEdges(fixture.input);
    });

    it('all segments are orthogonal', () => {
      for (let i = 0; i < result.edges.length; i++) {
        const path = extractPath(result, i);
        expect(isOrthogonal(path)).toBe(true);
      }
    });

    it('no path passes through obstacle interiors', () => {
      for (let i = 0; i < result.edges.length; i++) {
        const path = extractPath(result, i);
        for (const obs of fixture.input.obstacles) {
          expect(pathIntersectsObstacle(path, obs)).toBe(false);
        }
      }
    });

    it('startPoint equals sourcePoint and endPoint equals targetPoint', () => {
      for (let i = 0; i < result.edges.length; i++) {
        const section = result.edges[i].sections[0];
        const edge = fixture.input.edges[i];
        expect(section.startPoint).toEqual(edge.sourcePoint);
        expect(section.endPoint).toEqual(edge.targetPoint);
      }
    });

    it('output edge count equals input edge count', () => {
      expect(result.edges.length).toBe(fixture.input.edges.length);
    });

    it('output edge ids match input edge ids in order', () => {
      const outputIds = result.edges.map((e) => e.id);
      const inputIds = fixture.input.edges.map((e) => e.id);
      expect(outputIds).toEqual(inputIds);
    });

    it('incomingShape equals sourceId and outgoingShape equals targetId', () => {
      for (let i = 0; i < result.edges.length; i++) {
        const section = result.edges[i].sections[0];
        const edge = fixture.input.edges[i];
        expect(section.incomingShape).toBe(edge.sourceId);
        expect(section.outgoingShape).toBe(edge.targetId);
      }
    });

    if (fixture.hasPinnedEdges) {
      it('pinned waypoints are preserved exactly', () => {
        for (let i = 0; i < fixture.input.edges.length; i++) {
          const edge = fixture.input.edges[i];
          if (edge.pinnedWaypoints && edge.pinnedWaypoints.length > 0) {
            const section = result.edges[i].sections[0];
            expect(section.bendPoints).toEqual(edge.pinnedWaypoints);
          }
        }
      });
    }

    if (fixture.hasDirectionConstraints) {
      it('first segment respects sourceDirection constraint', () => {
        for (let i = 0; i < fixture.input.edges.length; i++) {
          const edge = fixture.input.edges[i];
          if (edge.sourceDirection) {
            const path = extractPath(result, i);
            if (path.length >= 2) {
              const dir = getSegmentDirection(path[0], path[1]);
              expect(dir).toBe(edge.sourceDirection);
            }
          }
        }
      });

      it('last segment respects targetDirection constraint', () => {
        for (let i = 0; i < fixture.input.edges.length; i++) {
          const edge = fixture.input.edges[i];
          if (edge.targetDirection) {
            const path = extractPath(result, i);
            if (path.length >= 2) {
              const dir = getSegmentDirection(path[path.length - 2], path[path.length - 1]);
              expect(dir).toBe(edge.targetDirection);
            }
          }
        }
      });
    }
  });
}
