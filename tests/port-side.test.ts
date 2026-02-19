import { describe, it, expect } from 'vitest';
import { routeEdges } from '../src/router.js';
import type { RouterInput, Obstacle, EdgeRequest } from '../src/types.js';

function isOrthogonal(path: Array<{ x: number; y: number }>): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    if (dx > 1e-9 && dy > 1e-9) return false;
  }
  return true;
}

function extractPath(result: { edges: Array<{ sections: Array<{ startPoint: { x: number; y: number }; bendPoints: Array<{ x: number; y: number }>; endPoint: { x: number; y: number } }> }> }, index: number) {
  const s = result.edges[index].sections[0];
  return [s.startPoint, ...s.bendPoints, s.endPoint];
}

describe('Port-side awareness', () => {
  const obstacles: Obstacle[] = [
    { id: 'A', x: 0, y: 0, width: 100, height: 50 },
    { id: 'B', x: 200, y: 0, width: 100, height: 50 },
  ];

  describe('basic port resolution', () => {
    it('resolves EAST port to right edge center', () => {
      const edges: EdgeRequest[] = [{
        id: 'e1', sourceId: 'A', targetId: 'B',
        sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 },
        sourcePort: { side: 'EAST' },
        targetPort: { side: 'WEST' },
      }];
      const result = routeEdges({ obstacles, edges });
      const path = extractPath(result, 0);
      // Source should be at right edge of A (x=100, y=25)
      expect(path[0].x).toBe(100);
      expect(path[0].y).toBe(25);
      // Target should be at left edge of B (x=200, y=25)
      expect(path[path.length - 1].x).toBe(200);
      expect(path[path.length - 1].y).toBe(25);
    });

    it('resolves SOUTH port to bottom edge center', () => {
      const below: Obstacle[] = [
        { id: 'top', x: 0, y: 0, width: 100, height: 50 },
        { id: 'bottom', x: 0, y: 200, width: 100, height: 50 },
      ];
      const edges: EdgeRequest[] = [{
        id: 'e1', sourceId: 'top', targetId: 'bottom',
        sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 },
        sourcePort: { side: 'SOUTH' },
        targetPort: { side: 'NORTH' },
      }];
      const result = routeEdges({ obstacles: below, edges });
      const path = extractPath(result, 0);
      // Source should be at bottom of top (x=50, y=50)
      expect(path[0].x).toBe(50);
      expect(path[0].y).toBe(50);
      // Target should be at top of bottom (x=50, y=200)
      expect(path[path.length - 1].x).toBe(50);
      expect(path[path.length - 1].y).toBe(200);
    });

    it('resolves NORTH port with custom offset', () => {
      const edges: EdgeRequest[] = [{
        id: 'e1', sourceId: 'A', targetId: 'B',
        sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 },
        sourcePort: { side: 'NORTH', offset: 0.25 },
        targetPort: { side: 'NORTH', offset: 0.75 },
      }];
      const result = routeEdges({ obstacles, edges });
      const path = extractPath(result, 0);
      // Source should be at top of A, 25% along width (x=25, y=0)
      expect(path[0].x).toBe(25);
      expect(path[0].y).toBe(0);
      // Target should be at top of B, 75% along width (x=275, y=0)
      expect(path[path.length - 1].x).toBe(275);
      expect(path[path.length - 1].y).toBe(0);
    });
  });

  describe('direction inference from ports', () => {
    it('EAST port sets sourceDirection to right', () => {
      const edges: EdgeRequest[] = [{
        id: 'e1', sourceId: 'A', targetId: 'B',
        sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 },
        sourcePort: { side: 'EAST' },
        targetPort: { side: 'WEST' },
      }];
      const result = routeEdges({ obstacles, edges });
      const path = extractPath(result, 0);
      // First segment should move right (increasing x)
      expect(path.length).toBeGreaterThanOrEqual(2);
      if (path.length >= 2) {
        expect(path[1].x).toBeGreaterThanOrEqual(path[0].x);
      }
    });

    it('explicit sourceDirection overrides port direction', () => {
      const below: Obstacle[] = [
        { id: 'A', x: 0, y: 0, width: 100, height: 50 },
        { id: 'B', x: 0, y: 200, width: 100, height: 50 },
      ];
      const edges: EdgeRequest[] = [{
        id: 'e1', sourceId: 'A', targetId: 'B',
        sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 },
        sourcePort: { side: 'SOUTH' },
        targetPort: { side: 'NORTH' },
        sourceDirection: 'down',
      }];
      const result = routeEdges({ obstacles: below, edges });
      const path = extractPath(result, 0);
      // Source should still be resolved from port
      expect(path[0].x).toBe(50);
      expect(path[0].y).toBe(50);
      // Direction should be 'down' as explicitly set
      if (path.length >= 2) {
        expect(path[1].y).toBeGreaterThan(path[0].y);
      }
    });
  });

  describe('multiple edges per port side', () => {
    it('distributes edges along a shared side', () => {
      const nodes: Obstacle[] = [
        { id: 'src', x: 0, y: 0, width: 100, height: 50 },
        { id: 'tgt1', x: 200, y: 0, width: 100, height: 50 },
        { id: 'tgt2', x: 200, y: 100, width: 100, height: 50 },
        { id: 'tgt3', x: 200, y: 200, width: 100, height: 50 },
      ];
      const edges: EdgeRequest[] = [
        {
          id: 'e1', sourceId: 'src', targetId: 'tgt1',
          sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 200, y: 25 },
          sourcePort: { side: 'EAST' },
        },
        {
          id: 'e2', sourceId: 'src', targetId: 'tgt2',
          sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 200, y: 125 },
          sourcePort: { side: 'EAST' },
        },
        {
          id: 'e3', sourceId: 'src', targetId: 'tgt3',
          sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 200, y: 225 },
          sourcePort: { side: 'EAST' },
        },
      ];
      const result = routeEdges({ obstacles: nodes, edges });

      // All 3 should start from EAST side (x=100) but at different y positions
      const starts = result.edges.map((e) => e.sections[0].startPoint);
      expect(starts[0].x).toBe(100);
      expect(starts[1].x).toBe(100);
      expect(starts[2].x).toBe(100);

      // Y positions should be distributed: 12.5, 25, 37.5 (i.e. 1/4, 1/2, 3/4)
      const ys = starts.map((s) => s.y).sort((a, b) => a - b);
      expect(ys[0]).toBeLessThan(ys[1]);
      expect(ys[1]).toBeLessThan(ys[2]);
    });
  });

  describe('port routing produces orthogonal paths', () => {
    it('all port-based routes are orthogonal', () => {
      const edges: EdgeRequest[] = [{
        id: 'e1', sourceId: 'A', targetId: 'B',
        sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 },
        sourcePort: { side: 'EAST' },
        targetPort: { side: 'WEST' },
      }];
      const result = routeEdges({ obstacles, edges });
      const path = extractPath(result, 0);
      expect(isOrthogonal(path)).toBe(true);
    });
  });
});
