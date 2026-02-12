import { describe, it, expect } from 'vitest';
import { routeEdges } from '../src/index.js';
import type { RouterInput, Obstacle, EdgeRequest } from '../src/types.js';

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Generate a grid layout of nodes with edges between horizontally and
 * vertically adjacent nodes. Each node is 40×30 with 60px spacing.
 */
function generateGridLayout(rows: number, cols: number): RouterInput {
  const nodeWidth = 40;
  const nodeHeight = 30;
  const spacingX = 60;
  const spacingY = 60;

  const obstacles: Obstacle[] = [];
  const edges: EdgeRequest[] = [];

  // Create obstacles
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `n${r}_${c}`;
      obstacles.push({
        id,
        x: c * (nodeWidth + spacingX),
        y: r * (nodeHeight + spacingY),
        width: nodeWidth,
        height: nodeHeight,
      });
    }
  }

  // Create edges between adjacent nodes
  let edgeId = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const srcId = `n${r}_${c}`;
      const srcObs = obstacles.find((o) => o.id === srcId)!;

      // Right neighbor
      if (c < cols - 1) {
        const tgtId = `n${r}_${c + 1}`;
        const tgtObs = obstacles.find((o) => o.id === tgtId)!;
        edges.push({
          id: `e${edgeId++}`,
          sourceId: srcId,
          targetId: tgtId,
          sourcePoint: { x: srcObs.x + srcObs.width, y: srcObs.y + srcObs.height / 2 },
          targetPoint: { x: tgtObs.x, y: tgtObs.y + tgtObs.height / 2 },
        });
      }

      // Down neighbor
      if (r < rows - 1) {
        const tgtId = `n${r + 1}_${c}`;
        const tgtObs = obstacles.find((o) => o.id === tgtId)!;
        edges.push({
          id: `e${edgeId++}`,
          sourceId: srcId,
          targetId: tgtId,
          sourcePoint: { x: srcObs.x + srcObs.width / 2, y: srcObs.y + srcObs.height },
          targetPoint: { x: tgtObs.x + tgtObs.width / 2, y: tgtObs.y },
        });
      }
    }
  }

  return { obstacles, edges };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Performance: grid scaling', () => {
  it('3×3 grid (9 obstacles, 12 edges) completes within 50ms', () => {
    const input = generateGridLayout(3, 3);
    expect(input.obstacles).toHaveLength(9);
    expect(input.edges).toHaveLength(12);

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('5×5 grid (25 obstacles, 40 edges) completes within 200ms', () => {
    const input = generateGridLayout(5, 5);
    expect(input.obstacles).toHaveLength(25);
    expect(input.edges).toHaveLength(40);

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('8×8 grid (64 obstacles, 112 edges) completes within 500ms', () => {
    const input = generateGridLayout(8, 8);
    expect(input.obstacles).toHaveLength(64);
    expect(input.edges).toHaveLength(112);

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('10×10 grid (100 obstacles, 180 edges) completes within 1000ms', () => {
    const input = generateGridLayout(10, 10);
    expect(input.obstacles).toHaveLength(100);
    expect(input.edges).toHaveLength(180);

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('15×15 grid (225 obstacles, 420 edges) completes within 5000ms', () => {
    const input = generateGridLayout(15, 15);
    expect(input.obstacles).toHaveLength(225);
    expect(input.edges).toHaveLength(420);

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('Performance: edge cases', () => {
  it('50 edges with no obstacles completes within 100ms', () => {
    const edges: EdgeRequest[] = [];
    for (let i = 0; i < 50; i++) {
      edges.push({
        id: `e${i}`,
        sourceId: 'src',
        targetId: 'tgt',
        sourcePoint: { x: 0, y: i * 20 },
        targetPoint: { x: 300, y: i * 20 },
      });
    }

    const input: RouterInput = { obstacles: [], edges };

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('50 obstacles with 1 edge completes within 100ms', () => {
    const obstacles: Obstacle[] = [];
    for (let i = 0; i < 50; i++) {
      obstacles.push({
        id: `obs${i}`,
        x: 20 + (i % 10) * 50,
        y: 20 + Math.floor(i / 10) * 50,
        width: 30,
        height: 30,
      });
    }

    const input: RouterInput = {
      obstacles,
      edges: [{
        id: 'e1',
        sourceId: 'A',
        targetId: 'B',
        sourcePoint: { x: 0, y: 0 },
        targetPoint: { x: 520, y: 270 },
      }],
    };

    const start = performance.now();
    routeEdges(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
