import type { Point, Segment, CardinalDirection } from './types.js';
import type { Grid } from './grid.js';
import { PriorityQueue } from './priority-queue.js';
import { manhattanDistance, pointKey, parsePointKey, orthogonalSegmentsCross } from './geometry.js';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface AStarState {
  key: string;       // position key
  direction: Direction;
}

function stateKey(posKey: string, dir: Direction): string {
  return `${posKey}|${dir}`;
}

function getDirection(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? 'down' : 'up';
  }
  // Exactly diagonal or same point
  return 'none';
}

function isBend(d1: Direction, d2: Direction): boolean {
  if (d1 === 'none' || d2 === 'none') return false;
  return d1 !== d2;
}

export interface PathfinderOptions {
  bendPenalty: number;
  crossingPenalty: number;
  lengthPenalty: number;
  sourceDirection?: CardinalDirection;
  targetDirection?: CardinalDirection;
}

/**
 * Routed segments from previously routed edges, used for crossing detection.
 */
export class RoutedSegments {
  private segments: Segment[] = [];

  addPath(path: Point[]): void {
    for (let i = 0; i < path.length - 1; i++) {
      this.segments.push({ p1: path[i], p2: path[i + 1] });
    }
  }

  countCrossings(seg: Segment): number {
    let count = 0;
    for (const existing of this.segments) {
      if (orthogonalSegmentsCross(seg, existing)) count++;
    }
    return count;
  }
}

/**
 * Find shortest orthogonal path from source to target on the grid using A*.
 * Uses directional state to correctly assess bend penalties.
 */
export function findPath(
  grid: Grid,
  source: Point,
  target: Point,
  options: PathfinderOptions,
  routedSegments?: RoutedSegments,
): Point[] | null {
  const sourceKey = pointKey(source);
  const targetKey = pointKey(target);

  if (!grid.vertices.has(sourceKey) || !grid.vertices.has(targetKey)) {
    return null;
  }

  // Same point
  if (sourceKey === targetKey) {
    return [source];
  }

  const pq = new PriorityQueue<AStarState>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { posKey: string; dir: Direction }>();

  // When sourceDirection is set, the start state uses that direction so only
  // matching initial moves are expanded without a bend penalty.
  const startDir: Direction = options.sourceDirection ?? 'none';
  const startState = stateKey(sourceKey, startDir);
  gScore.set(startState, 0);
  pq.push({ key: sourceKey, direction: startDir }, manhattanDistance(source, target) * options.lengthPenalty);

  while (!pq.isEmpty()) {
    const current = pq.pop()!;
    const currentStateKey = stateKey(current.key, current.direction);
    const currentG = gScore.get(currentStateKey)!;

    // Goal check — when targetDirection is set, only accept arrivals from the
    // correct direction (the last segment must move in targetDirection).
    if (current.key === targetKey) {
      if (!options.targetDirection || current.direction === options.targetDirection) {
        return reconstructPath(cameFrom, current.key, current.direction, sourceKey);
      }
      // Wrong arrival direction — keep searching for a better path
      continue;
    }

    const vertex = grid.vertices.get(current.key);
    if (!vertex) continue;

    const currentPoint = vertex.point;

    for (const [neighborKey, edgeDist] of vertex.neighbors) {
      const neighborVertex = grid.vertices.get(neighborKey);
      if (!neighborVertex) continue;

      const neighborPoint = neighborVertex.point;
      const moveDir = getDirection(currentPoint, neighborPoint);

      // Source direction constraint: from the source, only expand in the
      // specified direction.
      if (options.sourceDirection && current.key === sourceKey && moveDir !== options.sourceDirection) {
        continue;
      }

      // Calculate cost
      let cost = currentG + edgeDist * options.lengthPenalty;

      // Bend penalty
      if (isBend(current.direction, moveDir)) {
        cost += options.bendPenalty;
      }

      // Crossing penalty
      if (routedSegments) {
        const seg: Segment = { p1: currentPoint, p2: neighborPoint };
        const crossings = routedSegments.countCrossings(seg);
        cost += crossings * options.crossingPenalty;
      }

      const neighborStateKey = stateKey(neighborKey, moveDir);
      const existingG = gScore.get(neighborStateKey);

      if (existingG === undefined || cost < existingG) {
        gScore.set(neighborStateKey, cost);
        cameFrom.set(neighborStateKey, { posKey: current.key, dir: current.direction });

        const h = manhattanDistance(neighborPoint, target) * options.lengthPenalty;
        pq.push({ key: neighborKey, direction: moveDir }, cost + h);
      }
    }
  }

  return null; // No path found
}

function reconstructPath(
  cameFrom: Map<string, { posKey: string; dir: Direction }>,
  endKey: string,
  endDir: Direction,
  startKey: string,
): Point[] {
  const path: Point[] = [];
  let currentSK = stateKey(endKey, endDir);
  let currentPosKey = endKey;

  while (currentPosKey !== startKey || path.length === 0) {
    path.push(parsePointKey(currentPosKey));
    const prev = cameFrom.get(currentSK);
    if (!prev) break;
    currentSK = stateKey(prev.posKey, prev.dir);
    currentPosKey = prev.posKey;
  }

  // Add start point if not already added
  if (path.length === 0 || pointKey(path[path.length - 1]) !== startKey) {
    path.push(parsePointKey(startKey));
  }

  path.reverse();
  return path;
}
