import { describe, it, expect } from 'vitest';
import { routeEdges, routeEdgesIncremental } from '../src/index.js';
import type { RouterInput, EdgeRequest, Point } from '../src/types.js';

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

function runNTimes(input: RouterInput, n: number, options?: Parameters<typeof routeEdges>[1]) {
  return Array.from({ length: n }, () => routeEdges(input, options));
}

// ── Inputs ───────────────────────────────────────────────────────────────────

const simpleHorizontal: RouterInput = {
  obstacles: [],
  edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
};

const singleObstacle: RouterInput = {
  obstacles: [{ id: 'obs1', x: 80, y: 20, width: 40, height: 60 }],
  edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
};

const diamondGraph: RouterInput = {
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
};

const multipleCrossing: RouterInput = {
  obstacles: [
    { id: 'obs1', x: 80, y: 0, width: 40, height: 40 },
    { id: 'obs2', x: 80, y: 60, width: 40, height: 40 },
  ],
  edges: [
    makeEdge('e1', 'A', 'B', 0, 50, 200, 50),
    makeEdge('e2', 'C', 'D', 100, 0, 100, 120),
  ],
};

const pinnedEdge: RouterInput = {
  obstacles: [{ id: 'obs1', x: 60, y: 10, width: 30, height: 30 }],
  edges: [
    makeEdge('e1', 'A', 'B', 0, 0, 100, 50, {
      pinnedWaypoints: [{ x: 50, y: 0 }, { x: 50, y: 50 }],
    }),
  ],
};

const customOptions: RouterInput = {
  obstacles: [{ id: 'obs1', x: 80, y: 20, width: 40, height: 60 }],
  edges: [makeEdge('e1', 'A', 'B', 0, 50, 200, 50)],
};

const noObstacles: RouterInput = {
  obstacles: [],
  edges: [
    makeEdge('e1', 'A', 'B', 0, 0, 100, 0),
    makeEdge('e2', 'C', 'D', 0, 50, 100, 100),
  ],
};

const withObstacles: RouterInput = {
  obstacles: [
    { id: 'obs1', x: 40, y: -10, width: 20, height: 20 },
    { id: 'obs2', x: 40, y: 40, width: 20, height: 30 },
  ],
  edges: [
    makeEdge('e1', 'A', 'B', 0, 0, 100, 0),
    makeEdge('e2', 'C', 'D', 0, 50, 100, 50),
  ],
};

// ── N-run consistency ────────────────────────────────────────────────────────

describe('Determinism: N-run consistency', () => {
  it('simple horizontal — 5 runs produce identical output', () => {
    const results = runNTimes(simpleHorizontal, 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('single obstacle — 5 runs produce identical output', () => {
    const results = runNTimes(singleObstacle, 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('diamond graph — 5 runs produce identical output', () => {
    const results = runNTimes(diamondGraph, 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('multiple crossing edges — 5 runs produce identical output', () => {
    const results = runNTimes(multipleCrossing, 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('pinned edge — 5 runs produce identical output', () => {
    const results = runNTimes(pinnedEdge, 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('custom options — 5 runs produce identical output', () => {
    const opts = { bendPenalty: 100, crossingPenalty: 500 };
    const results = runNTimes(customOptions, 5, opts);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });
});

// ── Incremental initial-run equivalence ──────────────────────────────────────

describe('Determinism: incremental initial-run equivalence', () => {
  it('no obstacles — incremental(null,null) equals routeEdges', () => {
    const full = routeEdges(noObstacles);
    const incr = routeEdgesIncremental(noObstacles, null, null);
    expect(incr).toEqual(full);
  });

  it('with obstacles — incremental(null,null) equals routeEdges', () => {
    const full = routeEdges(withObstacles);
    const incr = routeEdgesIncremental(withObstacles, null, null);
    expect(incr).toEqual(full);
  });

  it('diamond graph — incremental(null,null) equals routeEdges', () => {
    const full = routeEdges(diamondGraph);
    const incr = routeEdgesIncremental(diamondGraph, null, null);
    expect(incr).toEqual(full);
  });
});

// ── Cross-invocation deep equality ───────────────────────────────────────────

describe('Determinism: cross-invocation deep equality', () => {
  it('structural deep-equal (not reference-equal)', () => {
    const r1 = routeEdges(diamondGraph);
    const r2 = routeEdges(diamondGraph);
    expect(r1).toEqual(r2);
    expect(r1).not.toBe(r2);
  });

  it('JSON.stringify identity across runs', () => {
    const r1 = routeEdges(diamondGraph);
    const r2 = routeEdges(diamondGraph);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
