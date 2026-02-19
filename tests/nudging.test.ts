import { describe, it, expect } from 'vitest';
import { centerInChannels, validateAgainstObstacles, spaceParallelSegments } from '../src/simplify.js';
import { routeEdges } from '../src/router.js';
import type { Point, Rect, Obstacle, RouterInput } from '../src/types.js';

function isOrthogonal(path: Point[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    if (dx > 1e-9 && dy > 1e-9) return false;
  }
  return true;
}

describe('Nudging: centerInChannels', () => {
  it('centers a horizontal segment between two obstacles', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },   // interior: horizontal seg at y=50
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    // Obstacles above and below the horizontal segment
    const obstacles: Rect[] = [
      { x: -10, y: 20, width: 120, height: 10 },  // bottom at y=30
      { x: -10, y: 70, width: 120, height: 10 },  // top at y=70
    ];
    const result = centerInChannels([path], obstacles);
    // The interior horizontal segment should be centered at y=50 (midpoint of 30 and 70)
    expect(result[0][1].y).toBe(50);
    expect(result[0][2].y).toBe(50);
    expect(isOrthogonal(result[0])).toBe(true);
  });

  it('centers a vertical segment between two obstacles', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },   // vertical seg at x=50
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ];
    const obstacles: Rect[] = [
      { x: 20, y: -10, width: 10, height: 120 },  // right edge at x=30
      { x: 70, y: -10, width: 10, height: 120 },  // left edge at x=70
    ];
    const result = centerInChannels([path], obstacles);
    // Should be centered at x=50 (midpoint of 30 and 70)
    expect(result[0][1].x).toBe(50);
    expect(result[0][2].x).toBe(50);
    expect(isOrthogonal(result[0])).toBe(true);
  });

  it('does not modify paths with fewer than 5 points', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    const result = centerInChannels([path], []);
    expect(result[0]).toEqual(path);
  });

  it('does not modify endpoint segments', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ];
    const result = centerInChannels([path], []);
    // Endpoints should be unchanged
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][4]).toEqual({ x: 200, y: 200 });
  });

  it('preserves orthogonality after centering', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    const obstacles: Rect[] = [
      { x: -10, y: 20, width: 120, height: 5 },
      { x: -10, y: 60, width: 120, height: 5 },
    ];
    const result = centerInChannels([path], obstacles);
    expect(isOrthogonal(result[0])).toBe(true);
  });
});

describe('Nudging: validateAgainstObstacles', () => {
  it('does not modify paths that are already valid', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    const result = validateAgainstObstacles([path], [], 10);
    expect(result[0]).toEqual(path);
  });

  it('does not modify endpoint-adjacent segments', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    // Even if there's an obstacle near the first segment, don't modify it
    const obstacles: Rect[] = [
      { x: -10, y: -5, width: 70, height: 10 },
    ];
    const result = validateAgainstObstacles([path], obstacles, 10);
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][2]).toEqual({ x: 50, y: 100 });
  });
});

describe('Nudging: topology-aware parallel spacing', () => {
  it('orders parallel segments by perpendicular position', () => {
    // Two paths that overlap on a horizontal segment
    const paths: Point[][] = [
      // Edge going from left-top to right-bottom
      [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 200 }],
      // Edge going from left-bottom to right-top
      [{ x: 0, y: 200 }, { x: 0, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 0 }],
    ];
    const result = spaceParallelSegments(paths, 8);

    // Both horizontal segments were at y=50, they should be spaced apart
    const y1 = result[0][1].y;
    const y2 = result[1][1].y;
    expect(y1).not.toBe(y2);
    expect(Math.abs(y1 - y2)).toBeCloseTo(8, 0);
  });
});

describe('Nudging: full pipeline preserves orthogonality', () => {
  it('routes multiple edges through a corridor with orthogonal paths', () => {
    const obstacles: Obstacle[] = [
      { id: 'top', x: 50, y: 0, width: 100, height: 30 },
      { id: 'bottom', x: 50, y: 70, width: 100, height: 30 },
    ];
    const input: RouterInput = {
      obstacles,
      edges: [
        {
          id: 'e1', sourceId: 'a', targetId: 'b',
          sourcePoint: { x: 0, y: 50 }, targetPoint: { x: 200, y: 50 },
        },
        {
          id: 'e2', sourceId: 'c', targetId: 'd',
          sourcePoint: { x: 0, y: 50 }, targetPoint: { x: 200, y: 50 },
        },
      ],
    };
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
});
