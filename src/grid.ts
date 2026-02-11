import type { Point, Obstacle, EdgeRequest, Rect } from './types.js';
import { expandRect, pointInRect, segmentIntersectsRect, pointKey } from './geometry.js';

export interface GridVertex {
  point: Point;
  neighbors: Map<string, number>; // key → edge weight
}

export interface Grid {
  vertices: Map<string, GridVertex>;
  expandedObstacles: Rect[];
  /** Original (non-expanded) obstacles for anchor connection logic */
  rawObstacles: Obstacle[];
}

/**
 * Build a sparse Manhattan grid from obstacles and edge anchors.
 */
export function buildGrid(
  obstacles: Obstacle[],
  edges: EdgeRequest[],
  obstacleMargin: number,
): Grid {
  const expandedObstacles = obstacles.map((o) => expandRect(o, obstacleMargin));

  // Collect anchor point keys (these are always allowed, even inside expanded obstacles)
  const anchorKeys = new Set<string>();
  for (const edge of edges) {
    anchorKeys.add(pointKey(edge.sourcePoint));
    anchorKeys.add(pointKey(edge.targetPoint));
  }

  // Collect x and y coordinates
  const xCoords = new Set<number>();
  const yCoords = new Set<number>();

  // From obstacle boundaries (expanded)
  for (const rect of expandedObstacles) {
    xCoords.add(rect.x);
    xCoords.add(rect.x + rect.width);
    yCoords.add(rect.y);
    yCoords.add(rect.y + rect.height);
  }

  // From edge anchors
  for (const edge of edges) {
    xCoords.add(edge.sourcePoint.x);
    xCoords.add(edge.targetPoint.x);
    yCoords.add(edge.sourcePoint.y);
    yCoords.add(edge.targetPoint.y);

    // From previous path for incremental seeding
    if (edge.previousPath) {
      for (const p of edge.previousPath) {
        xCoords.add(p.x);
        yCoords.add(p.y);
      }
    }
  }

  // Insert midpoint lines between adjacent obstacles for routing channels
  const sortedX = [...xCoords].sort((a, b) => a - b);
  const sortedY = [...yCoords].sort((a, b) => a - b);

  for (let i = 0; i < sortedX.length - 1; i++) {
    const mid = (sortedX[i] + sortedX[i + 1]) / 2;
    xCoords.add(mid);
  }
  for (let i = 0; i < sortedY.length - 1; i++) {
    const mid = (sortedY[i] + sortedY[i + 1]) / 2;
    yCoords.add(mid);
  }

  // Create vertices at intersections, excluding those inside obstacles
  // BUT always allowing anchor points
  const vertices = new Map<string, GridVertex>();
  const finalX = [...xCoords].sort((a, b) => a - b);
  const finalY = [...yCoords].sort((a, b) => a - b);

  for (const x of finalX) {
    for (const y of finalY) {
      const p: Point = { x, y };
      const key = pointKey(p);
      const isAnchor = anchorKeys.has(key);
      if (!isAnchor && isInsideAnyObstacle(p, expandedObstacles)) continue;
      vertices.set(key, { point: p, neighbors: new Map() });
    }
  }

  // Connect adjacent vertices along scan lines
  // Horizontal connections (same y, adjacent x)
  for (const y of finalY) {
    const xsAtY = finalX.filter((x) => vertices.has(pointKey({ x, y })));
    for (let i = 0; i < xsAtY.length - 1; i++) {
      const p1 = { x: xsAtY[i], y };
      const p2 = { x: xsAtY[i + 1], y };
      const seg = { p1, p2 };

      if (!segmentPassesThroughObstacle(seg, expandedObstacles)) {
        const k1 = pointKey(p1);
        const k2 = pointKey(p2);
        const dist = Math.abs(p2.x - p1.x);
        vertices.get(k1)!.neighbors.set(k2, dist);
        vertices.get(k2)!.neighbors.set(k1, dist);
      }
    }
  }

  // Vertical connections (same x, adjacent y)
  for (const x of finalX) {
    const ysAtX = finalY.filter((y) => vertices.has(pointKey({ x, y })));
    for (let i = 0; i < ysAtX.length - 1; i++) {
      const p1 = { x, y: ysAtX[i] };
      const p2 = { x, y: ysAtX[i + 1] };
      const seg = { p1, p2 };

      if (!segmentPassesThroughObstacle(seg, expandedObstacles)) {
        const k1 = pointKey(p1);
        const k2 = pointKey(p2);
        const dist = Math.abs(p2.y - p1.y);
        vertices.get(k1)!.neighbors.set(k2, dist);
        vertices.get(k2)!.neighbors.set(k1, dist);
      }
    }
  }

  return { vertices, expandedObstacles, rawObstacles: obstacles };
}

function isInsideAnyObstacle(p: Point, obstacles: Rect[]): boolean {
  return obstacles.some((o) => pointInRect(p, o));
}

function segmentPassesThroughObstacle(
  seg: { p1: Point; p2: Point },
  obstacles: Rect[],
): boolean {
  return obstacles.some((o) => segmentIntersectsRect(seg, o));
}

/**
 * Ensure a point exists in the grid by adding it and connecting to nearest
 * grid lines. Used to add edge anchors that may sit on obstacle borders.
 * For anchor points on obstacle borders, we connect through the margin zone
 * to reach the nearest grid vertex on the expanded obstacle boundary.
 */
export function ensurePointInGrid(
  grid: Grid,
  point: Point,
): void {
  const key = pointKey(point);

  if (!grid.vertices.has(key)) {
    const vertex: GridVertex = { point, neighbors: new Map() };
    grid.vertices.set(key, vertex);
  }

  const vertex = grid.vertices.get(key)!;

  // Always run connectAnchorToGrid for anchor points. A vertex may have
  // gotten partial connections from another anchor's processing but still
  // lack connections in other directions.
  connectAnchorToGrid(grid, key, point, vertex);
}

function connectAnchorToGrid(
  grid: Grid,
  key: string,
  point: Point,
  vertex: GridVertex,
): void {
  // Collect candidates on same x-line and same y-line, sorted by distance
  const sameXVertices: Array<{ key: string; vertex: GridVertex; dist: number }> = [];
  const sameYVertices: Array<{ key: string; vertex: GridVertex; dist: number }> = [];

  for (const [nKey, nVertex] of grid.vertices) {
    if (nKey === key) continue;
    const np = nVertex.point;

    if (Math.abs(np.x - point.x) < 1e-9) {
      sameXVertices.push({ key: nKey, vertex: nVertex, dist: Math.abs(np.y - point.y) });
    } else if (Math.abs(np.y - point.y) < 1e-9) {
      sameYVertices.push({ key: nKey, vertex: nVertex, dist: Math.abs(np.x - point.x) });
    }
  }

  // Sort by distance and connect to nearest on each side (up/down for x-line, left/right for y-line)
  sameXVertices.sort((a, b) => a.dist - b.dist);
  sameYVertices.sort((a, b) => a.dist - b.dist);

  // Connect on x-line (vertical neighbors): find nearest above and below
  const above = sameXVertices.find((v) => v.vertex.point.y < point.y &&
    !hasVertexBetween(grid, point, v.vertex.point, 'vertical') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const below = sameXVertices.find((v) => v.vertex.point.y > point.y &&
    !hasVertexBetween(grid, point, v.vertex.point, 'vertical') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));

  // Connect on y-line (horizontal neighbors): find nearest left and right
  const left = sameYVertices.find((v) => v.vertex.point.x < point.x &&
    !hasVertexBetween(grid, point, v.vertex.point, 'horizontal') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const right = sameYVertices.find((v) => v.vertex.point.x > point.x &&
    !hasVertexBetween(grid, point, v.vertex.point, 'horizontal') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));

  for (const neighbor of [above, below, left, right]) {
    if (neighbor) {
      vertex.neighbors.set(neighbor.key, neighbor.dist);
      neighbor.vertex.neighbors.set(key, neighbor.dist);
    }
  }
}

function segmentThroughRawObstacle(a: Point, b: Point, obstacles: Obstacle[]): boolean {
  const seg = { p1: a, p2: b };
  return obstacles.some((o) => segmentIntersectsRect(seg, o));
}

function hasVertexBetween(
  grid: Grid,
  a: Point,
  b: Point,
  direction: 'horizontal' | 'vertical',
): boolean {
  for (const [, v] of grid.vertices) {
    const p = v.point;
    if ((Math.abs(p.x - a.x) < 1e-9 && Math.abs(p.y - a.y) < 1e-9) ||
        (Math.abs(p.x - b.x) < 1e-9 && Math.abs(p.y - b.y) < 1e-9)) continue;

    if (direction === 'horizontal') {
      if (Math.abs(p.y - a.y) < 1e-9) {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        if (p.x > minX + 1e-9 && p.x < maxX - 1e-9) return true;
      }
    } else {
      if (Math.abs(p.x - a.x) < 1e-9) {
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        if (p.y > minY + 1e-9 && p.y < maxY - 1e-9) return true;
      }
    }
  }
  return false;
}
