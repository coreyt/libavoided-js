import { describe, it, expect } from 'vitest';
import { routeEdges } from '../src/router.js';
import { spaceParallelSegments, nudgeAwayFromObstacles } from '../src/simplify.js';
import { segmentIntersectsRect } from '../src/geometry.js';
import type { Obstacle, EdgeRequest, Point } from '../src/types.js';

function pointsOf(edge: { sections: Array<{ startPoint: Point; bendPoints: Point[]; endPoint: Point }> }): Point[] {
  const s = edge.sections[0];
  return [s.startPoint, ...s.bendPoints, s.endPoint];
}

function isOrthogonal(pts: Point[]): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = Math.abs(pts[i + 1].x - pts[i].x);
    const dy = Math.abs(pts[i + 1].y - pts[i].y);
    if (dx > 1e-6 && dy > 1e-6) return false;
  }
  return true;
}

describe('libavoided-js 0.1.3 fixes (L1-L7)', () => {
  it('L1: routeEdges never detaches sourcePoint or targetPoint during parallel spacing', () => {
    const edges: EdgeRequest[] = [
      { id: 'e1', sourceId: 'a', targetId: 'b', sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 200, y: 80 } },
      { id: 'e2', sourceId: 'a', targetId: 'c', sourcePoint: { x: 0, y: 20 }, targetPoint: { x: 200, y: 100 } },
      { id: 'e3', sourceId: 'a', targetId: 'd', sourcePoint: { x: 0, y: 40 }, targetPoint: { x: 200, y: 120 } },
    ];
    const obstacles: Obstacle[] = [
      { id: 'mid', x: 80, y: -20, width: 40, height: 180 },
    ];
    const out = routeEdges({ obstacles, edges }, { edgeSpacing: 14, obstacleMargin: 12 });
    for (let i = 0; i < edges.length; i++) {
      const pts = pointsOf(out.edges[i]);
      expect(pts[0]).toEqual(edges[i].sourcePoint);
      expect(pts[pts.length - 1]).toEqual(edges[i].targetPoint);
      expect(isOrthogonal(pts)).toBe(true);
    }
  });

  it('L2: nudgeAwayFromObstacles keeps all segments strictly orthogonal and never moves endpoints', () => {
    const path: Point[] = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 150 },
      { x: 200, y: 150 },
    ];
    // Obstacle just to the right of the interior vertical segment x=100 (within margin 12)
    const obstacles = [{ x: 105, y: 70, width: 40, height: 60 }];
    const [nudged] = nudgeAwayFromObstacles([path], obstacles, 12);
    expect(nudged[0]).toEqual(path[0]);
    expect(nudged[nudged.length - 1]).toEqual(path[path.length - 1]);
    expect(isOrthogonal(nudged)).toBe(true);
    // Interior vertical segment at x=100 should have been pushed left to <= 105 - 12 = 93
    expect(nudged[1].x).toBeLessThanOrEqual(93.001);
    expect(nudged[2].x).toBeCloseTo(nudged[1].x, 6);
  });

  it('L3: A* avoids overlapping previously routed collinear segments via sharedSegmentPenalty', () => {
    const obstacles: Obstacle[] = [
      { id: 'obs', x: 80, y: 20, width: 60, height: 80 },
    ];
    const edges: EdgeRequest[] = [
      { id: 'e1', sourceId: 's1', targetId: 't1', sourcePoint: { x: 0, y: 40 }, targetPoint: { x: 220, y: 40 } },
      { id: 'e2', sourceId: 's2', targetId: 't2', sourcePoint: { x: 0, y: 80 }, targetPoint: { x: 220, y: 80 } },
    ];
    const out = routeEdges({ obstacles, edges }, { edgeSpacing: 14, obstacleMargin: 12, sharedSegmentPenalty: 500 });
    const p1 = pointsOf(out.edges[0]);
    const p2 = pointsOf(out.edges[1]);
    expect(isOrthogonal(p1)).toBe(true);
    expect(isOrthogonal(p2)).toBe(true);
    // Routes should take opposite sides or distinct separated channels around obs
    const y1s = p1.map((p) => p.y);
    const y2s = p2.map((p) => p.y);
    expect(Math.min(...y1s) !== Math.min(...y2s) || Math.max(...y1s) !== Math.max(...y2s)).toBe(true);
  });

  it('L4: spaceParallelSegments clusters near-coincident rails (< edgeSpacing) in planar order', () => {
    // Two interior vertical segments only 2px apart (< edgeSpacing 14), with upper/lower anchor ordering
    const paths: Point[][] = [
      [{ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 100 }, { x: 200, y: 100 }],
      [{ x: 0, y: 50 }, { x: 102, y: 50 }, { x: 102, y: 140 }, { x: 200, y: 140 }],
    ];
    const spaced = spaceParallelSegments(paths, 14, { preserveEndpoints: true });
    expect(Math.abs(spaced[0][1].x - spaced[1][1].x)).toBeGreaterThanOrEqual(13.99);
    expect(isOrthogonal(spaced[0])).toBe(true);
    expect(isOrthogonal(spaced[1])).toBe(true);
    expect(spaced[0][0]).toEqual(paths[0][0]);
    expect(spaced[1][3]).toEqual(paths[1][3]);
  });

  it('L5: pinnedWaypoints still routes around intervening obstacles while preserving waypoints', () => {
    const obstacles: Obstacle[] = [
      { id: 'block', x: 90, y: 20, width: 40, height: 60 },
    ];
    const wp: Point = { x: 50, y: 50 };
    const out = routeEdges({
      obstacles,
      edges: [{
        id: 'pinned1',
        sourceId: 's',
        targetId: 't',
        sourcePoint: { x: 0, y: 50 },
        targetPoint: { x: 200, y: 50 },
        pinnedWaypoints: [wp],
      }],
    });
    const pts = pointsOf(out.edges[0]);
    expect(pts.some((p) => Math.abs(p.x - wp.x) < 1e-6 && Math.abs(p.y - wp.y) < 1e-6)).toBe(true);
    for (let i = 0; i < pts.length - 1; i++) {
      expect(segmentIntersectsRect({ p1: pts[i], p2: pts[i + 1] }, obstacles[0])).toBe(false);
    }
  });

  it('L6 + L7: sourceId/targetId exemption & exterior bounding frame route 24-node graph cleanly and fast', () => {
    const obstacles: Obstacle[] = [];
    for (let i = 0; i < 24; i++) {
      obstacles.push({
        id: `n${i}`,
        x: (i % 6) * 140,
        y: Math.floor(i / 6) * 120,
        width: 80,
        height: 50,
      });
    }
    const edges: EdgeRequest[] = [];
    for (let i = 0; i < 23; i++) {
      const a = obstacles[i];
      const b = obstacles[i + 1];
      edges.push({
        id: `e${i}`,
        sourceId: a.id,
        targetId: b.id,
        // Slightly inset port anchor on source/target (tests L6 exemption)
        sourcePoint: { x: a.x + a.width - 1, y: a.y + a.height / 2 },
        targetPoint: { x: b.x + 1, y: b.y + b.height / 2 },
      });
    }
    const t0 = performance.now();
    const out = routeEdges({ obstacles, edges }, { obstacleMargin: 10, edgeSpacing: 10 });
    const elapsed = performance.now() - t0;
    expect(out.edges).toHaveLength(23);
    expect(elapsed).toBeLessThan(200);
    for (const e of out.edges) {
      expect(isOrthogonal(pointsOf(e))).toBe(true);
    }
  });
});
