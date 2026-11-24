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
  /** Sorted Y coordinates per X line for O(log N) anchor connection (L7). */
  xLines?: Map<number, number[]>;
  /** Sorted X coordinates per Y line for O(log N) anchor connection (L7). */
  yLines?: Map<number, number[]>;
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

  // From edge anchors and pinned waypoints (L5)
  for (const edge of edges) {
    xCoords.add(edge.sourcePoint.x);
    xCoords.add(edge.targetPoint.x);
    yCoords.add(edge.sourcePoint.y);
    yCoords.add(edge.targetPoint.y);

    if (edge.pinnedWaypoints) {
      for (const wp of edge.pinnedWaypoints) {
        xCoords.add(wp.x);
        yCoords.add(wp.y);
      }
    }

    // From previous path for incremental seeding
    if (edge.previousPath) {
      for (const p of edge.previousPath) {
        xCoords.add(p.x);
        yCoords.add(p.y);
      }
    }
  }

  // Exterior bounding frame so outer routes always have an unobstructed channel (L7)
  if (xCoords.size > 0 && yCoords.size > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of xCoords) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    for (const y of yCoords) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const pad = Math.max(16, obstacleMargin * 2);
    xCoords.add(minX - pad);
    xCoords.add(maxX + pad);
    yCoords.add(minY - pad);
    yCoords.add(maxY + pad);
  }

  // Insert midpoint lines between adjacent coordinates that have enough room for a channel (L7).
  // For large dense graphs, only bisect wider gaps so grid size stays O(N) instead of blowing up.
  const sortedX = [...xCoords].sort((a, b) => a - b);
  const sortedY = [...yCoords].sort((a, b) => a - b);
  const minMidGapX = sortedX.length > 40 ? Math.max(16, obstacleMargin * 1.5) : 4;
  const minMidGapY = sortedY.length > 40 ? Math.max(16, obstacleMargin * 1.5) : 4;

  for (let i = 0; i < sortedX.length - 1; i++) {
    if (sortedX[i + 1] - sortedX[i] >= minMidGapX) {
      xCoords.add((sortedX[i] + sortedX[i + 1]) / 2);
    }
  }
  for (let i = 0; i < sortedY.length - 1; i++) {
    if (sortedY[i + 1] - sortedY[i] >= minMidGapY) {
      yCoords.add((sortedY[i] + sortedY[i + 1]) / 2);
    }
  }

  // Create vertices at intersections, excluding those inside obstacles
  // BUT always allowing anchor points
  const vertices = new Map<string, GridVertex>();
  const finalX = [...xCoords].sort((a, b) => a - b);
  const finalY = [...yCoords].sort((a, b) => a - b);
  const xLines = new Map<number, number[]>();
  const yLines = new Map<number, number[]>();

  for (const x of finalX) {
    const ys: number[] = [];
    for (const y of finalY) {
      const p: Point = { x, y };
      const key = pointKey(p);
      const isAnchor = anchorKeys.has(key);
      if (!isAnchor && isInsideAnyObstacle(p, expandedObstacles)) continue;
      vertices.set(key, { point: p, neighbors: new Map() });
      ys.push(y);
      let xs = yLines.get(y);
      if (!xs) { xs = []; yLines.set(y, xs); }
      xs.push(x);
    }
    if (ys.length > 0) xLines.set(x, ys);
  }

  // Connect adjacent vertices along scan lines using indexed lines (L7)
  for (const [y, xsAtY] of yLines) {
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

  for (const [x, ysAtX] of xLines) {
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

  return { vertices, expandedObstacles, rawObstacles: obstacles, xLines, yLines };
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
function insertSortedUnique(arr: number[], value: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value - 1e-9) lo = mid + 1;
    else hi = mid;
  }
  if (lo < arr.length && Math.abs(arr[lo] - value) < 1e-9) return lo;
  arr.splice(lo, 0, value);
  return lo;
}

export function ensurePointInGrid(
  grid: Grid,
  point: Point,
  exemptObstacleIds?: ReadonlySet<string>,
): void {
  const key = pointKey(point);

  if (!grid.vertices.has(key)) {
    const vertex: GridVertex = { point, neighbors: new Map() };
    grid.vertices.set(key, vertex);
  }

  if (grid.xLines) {
    let ys = grid.xLines.get(point.x);
    if (!ys) { ys = []; grid.xLines.set(point.x, ys); }
    insertSortedUnique(ys, point.y);
  }
  if (grid.yLines) {
    let xs = grid.yLines.get(point.y);
    if (!xs) { xs = []; grid.yLines.set(point.y, xs); }
    insertSortedUnique(xs, point.x);
  }

  const vertex = grid.vertices.get(key)!;

  // Always run connectAnchorToGrid for anchor points. A vertex may have
  // gotten partial connections from another anchor's processing but still
  // lack connections in other directions.
  connectAnchorToGrid(grid, key, point, vertex, exemptObstacleIds);
}

function connectAnchorToGrid(
  grid: Grid,
  key: string,
  point: Point,
  vertex: GridVertex,
  exemptObstacleIds?: ReadonlySet<string>,
): void {
  // L6: Only exempt own sourceId/targetId obstacles when the anchor sits strictly INSIDE
  // that obstacle (e.g. inset stencil/concave port), and only on the nearest exit side
  // so a border anchor can never tunnel backwards through its own shape.
  const rawObs = exemptObstacleIds && exemptObstacleIds.size > 0
    ? grid.rawObstacles.filter((o) => !(exemptObstacleIds.has(o.id) && pointInRect(point, o)))
    : grid.rawObstacles;

  // Fast O(log N) path using indexed scan lines (L7)
  if (grid.xLines && grid.yLines) {
    const ys = grid.xLines.get(point.x);
    if (ys) {
      const idx = insertSortedUnique(ys, point.y);
      if (idx > 0) {
        const np = { x: point.x, y: ys[idx - 1] };
        const nKey = pointKey(np);
        const nVertex = grid.vertices.get(nKey);
        if (nVertex && !segmentThroughRawObstacle(point, np, rawObs)) {
          const dist = Math.abs(point.y - np.y);
          vertex.neighbors.set(nKey, dist);
          nVertex.neighbors.set(key, dist);
        }
      }
      if (idx + 1 < ys.length) {
        const np = { x: point.x, y: ys[idx + 1] };
        const nKey = pointKey(np);
        const nVertex = grid.vertices.get(nKey);
        if (nVertex && !segmentThroughRawObstacle(point, np, rawObs)) {
          const dist = Math.abs(np.y - point.y);
          vertex.neighbors.set(nKey, dist);
          nVertex.neighbors.set(key, dist);
        }
      }
    }

    const xs = grid.yLines.get(point.y);
    if (xs) {
      const idx = insertSortedUnique(xs, point.x);
      if (idx > 0) {
        const np = { x: xs[idx - 1], y: point.y };
        const nKey = pointKey(np);
        const nVertex = grid.vertices.get(nKey);
        if (nVertex && !segmentThroughRawObstacle(point, np, rawObs)) {
          const dist = Math.abs(point.x - np.x);
          vertex.neighbors.set(nKey, dist);
          nVertex.neighbors.set(key, dist);
        }
      }
      if (idx + 1 < xs.length) {
        const np = { x: xs[idx + 1], y: point.y };
        const nKey = pointKey(np);
        const nVertex = grid.vertices.get(nKey);
        if (nVertex && !segmentThroughRawObstacle(point, np, rawObs)) {
          const dist = Math.abs(np.x - point.x);
          vertex.neighbors.set(nKey, dist);
          nVertex.neighbors.set(key, dist);
        }
      }
    }
    return;
  }

  // Fallback for manually constructed Grids without scan-line indices
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

  sameXVertices.sort((a, b) => a.dist - b.dist);
  sameYVertices.sort((a, b) => a.dist - b.dist);

  const above = sameXVertices.find((v) => v.vertex.point.y < point.y &&
    !hasVertexBetween(grid, point, v.vertex.point, 'vertical') &&
    !segmentThroughRawObstacle(point, v.vertex.point, rawObs));
  const below = sameXVertices.find((v) => v.vertex.point.y > point.y &&
    !hasVertexBetween(grid, point, v.vertex.point, 'vertical') &&
    !segmentThroughRawObstacle(point, v.vertex.point, rawObs));

  const left = sameYVertices.find((v) => v.vertex.point.x < point.x &&
    !hasVertexBetween(grid, point, v.vertex.point, 'horizontal') &&
    !segmentThroughRawObstacle(point, v.vertex.point, rawObs));
  const right = sameYVertices.find((v) => v.vertex.point.x > point.x &&
    !hasVertexBetween(grid, point, v.vertex.point, 'horizontal') &&
    !segmentThroughRawObstacle(point, v.vertex.point, rawObs));

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
