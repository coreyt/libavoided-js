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
  /** Index: x-coordinate → set of point keys at that x */
  xIndex: Map<number, Set<string>>;
  /** Index: y-coordinate → set of point keys at that y */
  yIndex: Map<number, Set<string>>;
}

/**
 * Normalize obstacles: filter zero/negative dimensions, deduplicate by id.
 */
export function normalizeObstacles(obstacles: Obstacle[]): Obstacle[] {
  const seen = new Map<string, Obstacle>();
  for (const o of obstacles) {
    if (o.width <= 0 || o.height <= 0) continue;
    seen.set(o.id, o);
  }
  return [...seen.values()];
}

function roundCoord(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function addToIndex(grid: Grid, point: Point, key: string): void {
  const rx = roundCoord(point.x);
  const ry = roundCoord(point.y);
  if (!grid.xIndex.has(rx)) grid.xIndex.set(rx, new Set());
  grid.xIndex.get(rx)!.add(key);
  if (!grid.yIndex.has(ry)) grid.yIndex.set(ry, new Set());
  grid.yIndex.get(ry)!.add(key);
}

/**
 * Build a sparse Manhattan grid from obstacles and edge anchors.
 */
export function buildGrid(
  obstacles: Obstacle[],
  edges: EdgeRequest[],
  obstacleMargin: number,
): Grid {
  const normalized = normalizeObstacles(obstacles);
  const expandedObstacles = normalized.map((o) => expandRect(o, obstacleMargin));

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
  const xIndex = new Map<number, Set<string>>();
  const yIndex = new Map<number, Set<string>>();
  const grid: Grid = { vertices, expandedObstacles, rawObstacles: normalized, xIndex, yIndex };

  const finalX = [...xCoords].sort((a, b) => a - b);
  const finalY = [...yCoords].sort((a, b) => a - b);

  for (const x of finalX) {
    for (const y of finalY) {
      const p: Point = { x, y };
      const key = pointKey(p);
      const isAnchor = anchorKeys.has(key);
      if (!isAnchor && isInsideAnyObstacle(p, expandedObstacles)) continue;
      vertices.set(key, { point: p, neighbors: new Map() });
      addToIndex(grid, p, key);
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

  return grid;
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
 */
export function ensurePointInGrid(
  grid: Grid,
  point: Point,
): void {
  const key = pointKey(point);

  if (!grid.vertices.has(key)) {
    const vertex: GridVertex = { point, neighbors: new Map() };
    grid.vertices.set(key, vertex);
    addToIndex(grid, point, key);
  }

  const vertex = grid.vertices.get(key)!;
  connectAnchorToGrid(grid, key, point, vertex);
}

function connectAnchorToGrid(
  grid: Grid,
  key: string,
  point: Point,
  vertex: GridVertex,
): void {
  const rx = roundCoord(point.x);
  const ry = roundCoord(point.y);

  // Collect candidates on same x-line (vertical neighbors) using index
  const sameXKeys = grid.xIndex.get(rx);
  const sameXVertices: Array<{ key: string; vertex: GridVertex; dist: number }> = [];
  if (sameXKeys) {
    for (const nKey of sameXKeys) {
      if (nKey === key) continue;
      const nVertex = grid.vertices.get(nKey);
      if (!nVertex) continue;
      sameXVertices.push({ key: nKey, vertex: nVertex, dist: Math.abs(nVertex.point.y - point.y) });
    }
  }

  // Collect candidates on same y-line (horizontal neighbors) using index
  const sameYKeys = grid.yIndex.get(ry);
  const sameYVertices: Array<{ key: string; vertex: GridVertex; dist: number }> = [];
  if (sameYKeys) {
    for (const nKey of sameYKeys) {
      if (nKey === key) continue;
      const nVertex = grid.vertices.get(nKey);
      if (!nVertex) continue;
      sameYVertices.push({ key: nKey, vertex: nVertex, dist: Math.abs(nVertex.point.x - point.x) });
    }
  }

  sameXVertices.sort((a, b) => a.dist - b.dist);
  sameYVertices.sort((a, b) => a.dist - b.dist);

  const above = sameXVertices.find((v) => v.vertex.point.y < point.y &&
    !hasVertexBetweenIndexed(grid, point, v.vertex.point, 'vertical') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const below = sameXVertices.find((v) => v.vertex.point.y > point.y &&
    !hasVertexBetweenIndexed(grid, point, v.vertex.point, 'vertical') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));

  const left = sameYVertices.find((v) => v.vertex.point.x < point.x &&
    !hasVertexBetweenIndexed(grid, point, v.vertex.point, 'horizontal') &&
    !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const right = sameYVertices.find((v) => v.vertex.point.x > point.x &&
    !hasVertexBetweenIndexed(grid, point, v.vertex.point, 'horizontal') &&
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

/**
 * Check if there's a vertex between two points using coordinate indices.
 */
function hasVertexBetweenIndexed(
  grid: Grid,
  a: Point,
  b: Point,
  direction: 'horizontal' | 'vertical',
): boolean {
  if (direction === 'horizontal') {
    const ry = roundCoord(a.y);
    const keys = grid.yIndex.get(ry);
    if (!keys) return false;
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    for (const k of keys) {
      const v = grid.vertices.get(k);
      if (!v) continue;
      if (v.point.x > minX + 1e-9 && v.point.x < maxX - 1e-9) return true;
    }
    return false;
  } else {
    const rx = roundCoord(a.x);
    const keys = grid.xIndex.get(rx);
    if (!keys) return false;
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (const k of keys) {
      const v = grid.vertices.get(k);
      if (!v) continue;
      if (v.point.y > minY + 1e-9 && v.point.y < maxY - 1e-9) return true;
    }
    return false;
  }
}

/**
 * Add extra scan lines around points to expand routing options.
 * Used when initial pathfinding fails to find a route.
 */
export function expandGridAroundPoints(
  grid: Grid,
  points: Point[],
  spread: number,
): void {
  const expandedObstacles = grid.expandedObstacles;

  for (const p of points) {
    const offsets = [-spread, 0, spread];
    for (const dx of offsets) {
      for (const dy of offsets) {
        if (dx === 0 && dy === 0) continue;
        const np: Point = { x: p.x + dx, y: p.y + dy };
        const key = pointKey(np);
        if (grid.vertices.has(key)) continue;
        if (isInsideAnyObstacle(np, expandedObstacles)) continue;

        const vertex: GridVertex = { point: np, neighbors: new Map() };
        grid.vertices.set(key, vertex);
        addToIndex(grid, np, key);
        connectAnchorToGrid(grid, key, np, vertex);
      }
    }
  }
}
