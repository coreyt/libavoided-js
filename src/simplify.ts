import type { Point, Rect } from './types.js';
import { areCollinear, segmentIntersectsRect } from './geometry.js';

export interface SimplifyOptions {
  /** Keep start and end points strictly fixed (L1). Default false for direct utility calls, true from routeEdges. */
  preserveEndpoints?: boolean;
  /** Raw obstacle bounds used to clamp parallel spacing & obstacle nudging without colliding (L2/L4). */
  obstacles?: Rect[];
}

/**
 * Remove collinear middle points from an orthogonal path.
 * If three consecutive points share the same x or y, the middle one is redundant.
 */
export function mergeCollinear(path: Point[]): Point[] {
  if (path.length <= 2) return [...path];

  const result: Point[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    if (!areCollinear(result[result.length - 1], path[i], path[i + 1])) {
      result.push(path[i]);
    }
  }

  result.push(path[path.length - 1]);
  return result;
}

/**
 * Space apart parallel edge segments that overlap or sit closer than edgeSpacing.
 * Maintains orthogonal consistency by adjusting adjacent segments when a shared
 * bend point is moved, orders clusters planarly to minimize crossings (L4),
 * preserves start/end port anchors when preserveEndpoints is set (L1), and avoids
 * pushing rails into obstacles (L4).
 */
export function spaceParallelSegments(
  paths: Point[][],
  edgeSpacing: number,
  options?: SimplifyOptions,
): Point[][] {
  const result = paths.map((p) => p.map((pt) => ({ ...pt })));
  const preserveEndpoints = options?.preserveEndpoints ?? false;
  const obstacles = options?.obstacles ?? [];
  const spacingTol = Math.max(1e-6, edgeSpacing - 1e-6);

  interface SegInfo {
    edgeIndex: number;
    segIndex: number;
    orientation: 'horizontal' | 'vertical';
    coord: number;
    min: number;
    max: number;
    /** Secondary-axis anchor hint from adjacent vertices for planar ordering (L4). */
    planarOrderKey: number;
  }

  for (const orientation of ['horizontal', 'vertical'] as const) {
    const segs: SegInfo[] = [];
    for (let eIdx = 0; eIdx < result.length; eIdx++) {
      const path = result[eIdx];
      for (let sIdx = 0; sIdx < path.length - 1; sIdx++) {
        // L1: never detach startPoint or targetPoint when preserveEndpoints is enabled.
        if (preserveEndpoints && (sIdx === 0 || sIdx + 1 === path.length - 1)) continue;
        const p1 = path[sIdx];
        const p2 = path[sIdx + 1];
        const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
        const isVert = Math.abs(p1.x - p2.x) < 1e-9;
        if (orientation === 'horizontal' && !isHoriz) continue;
        if (orientation === 'vertical' && !isVert) continue;

        const coord = orientation === 'horizontal' ? p1.y : p1.x;
        const min = orientation === 'horizontal' ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y);
        const max = orientation === 'horizontal' ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y);
        if (max - min <= 1e-9) continue;

        // Planar ordering key: average perpendicular position of prev/next connected vertices.
        const adj: number[] = [];
        if (sIdx > 0) adj.push(orientation === 'horizontal' ? path[sIdx - 1].y : path[sIdx - 1].x);
        if (sIdx + 2 < path.length) adj.push(orientation === 'horizontal' ? path[sIdx + 2].y : path[sIdx + 2].x);
        const planarOrderKey = adj.length ? adj.reduce((a, b) => a + b, 0) / adj.length : coord;

        segs.push({ edgeIndex: eIdx, segIndex: sIdx, orientation, coord, min, max, planarOrderKey });
      }
    }

    if (segs.length <= 1) continue;

    // L4: cluster parallel segments from different edges that overlap longitudinally
    // AND sit within < edgeSpacing perpendicularly (connected components).
    const visited = new Uint8Array(segs.length);
    for (let i = 0; i < segs.length; i++) {
      if (visited[i]) continue;
      const comp: SegInfo[] = [];
      const queue = [i];
      visited[i] = 1;
      while (queue.length > 0) {
        const curIdx = queue.pop()!;
        const cur = segs[curIdx];
        comp.push(cur);
        for (let j = 0; j < segs.length; j++) {
          if (visited[j]) continue;
          const cand = segs[j];
          if (cand.edgeIndex === cur.edgeIndex) continue;
          if (Math.abs(cand.coord - cur.coord) < spacingTol
            && cand.min < cur.max - 1e-9 && cand.max > cur.min + 1e-9) {
            visited[j] = 1;
            queue.push(j);
          }
        }
      }

      // Deduplicate by edge (first segment per edge in component).
      const byEdge = new Map<number, SegInfo>();
      for (const s of comp) {
        if (!byEdge.has(s.edgeIndex)) byEdge.set(s.edgeIndex, s);
      }
      const unique = [...byEdge.values()];
      if (unique.length <= 1) continue;

      // Planar ordering (L4): sort by planarOrderKey, then original coord, then edgeIndex.
      unique.sort((a, b) =>
        (a.planarOrderKey - b.planarOrderKey)
        || (a.coord - b.coord)
        || (a.edgeIndex - b.edgeIndex));

      const centerCoord = unique.reduce((sum, s) => sum + s.coord, 0) / unique.length;
      const totalSpread = (unique.length - 1) * edgeSpacing;

      for (let k = 0; k < unique.length; k++) {
        const seg = unique[k];
        const targetCoord = centerCoord - totalSpread / 2 + k * edgeSpacing;
        const offset = targetCoord - seg.coord;
        if (Math.abs(offset) < 1e-9) continue;

        const path = result[seg.edgeIndex];
        // L4 obstacle check: verify shifted segment and adjacent connectors stay clear of obstacles.
        if (obstacles.length > 0 && wouldHitObstacle(path, seg.segIndex, orientation, offset, obstacles)) {
          continue;
        }
        shiftSegment(path, seg.segIndex, orientation, offset);
      }
    }
  }

  return result;
}

function wouldHitObstacle(
  path: Point[],
  segIndex: number,
  orientation: 'horizontal' | 'vertical',
  offset: number,
  obstacles: Rect[],
): boolean {
  const p1 = { ...path[segIndex] };
  const p2 = { ...path[segIndex + 1] };
  if (orientation === 'horizontal') {
    p1.y += offset;
    p2.y += offset;
  } else {
    p1.x += offset;
    p2.x += offset;
  }
  const shiftedSeg = { p1, p2 };
  for (const obs of obstacles) {
    if (segmentIntersectsRect(shiftedSeg, obs)) return true;
  }
  return false;
}

/**
 * Shift a segment by offset in its perpendicular direction, maintaining
 * orthogonal connections with adjacent segments.
 */
function shiftSegment(
  path: Point[],
  segIndex: number,
  orientation: 'horizontal' | 'vertical',
  offset: number,
): void {
  if (orientation === 'horizontal') {
    // Shift the y-coordinate of both endpoints
    path[segIndex].y += offset;
    path[segIndex + 1].y += offset;

    // Fix adjacent vertical segments: adjust the connecting endpoint
    // Previous segment (segIndex-1 → segIndex) should be vertical
    // Its end y should match the new y
    // We don't modify it — the shared point already got shifted.
    // But the OTHER end of the adjacent segment didn't shift,
    // so the adjacent segment is still vertical (same x, different y range). OK.

    // Next segment (segIndex+1 → segIndex+2) same reasoning.
    // The shared point shifted, the far point didn't. Still vertical. OK.
  } else {
    // Shift the x-coordinate of both endpoints
    path[segIndex].x += offset;
    path[segIndex + 1].x += offset;
  }
}

/**
 * Push segments that are too close to obstacle boundaries away.
 * Only shifts entire segments along their perpendicular axis to maintain orthogonality.
 * Does not modify start/end points of the path.
 */
export function nudgeAwayFromObstacles(
  paths: Point[][],
  obstacles: Rect[],
  margin: number,
): Point[][] {
  return paths.map((path) => nudgePath(path, obstacles, margin));
}

function nudgePath(path: Point[], obstacles: Rect[], margin: number): Point[] {
  if (path.length <= 3) return [...path.map((p) => ({ ...p }))];

  const result = path.map((p) => ({ ...p }));

  // L2: Only nudge strictly interior segments (both endpoints are interior bends)
  // so endpoints stay anchored AND both ends move together, preserving orthogonality.
  for (let i = 1; i < result.length - 2; i++) {
    const p1 = result[i];
    const p2 = result[i + 1];

    const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
    const isVert = Math.abs(p1.x - p2.x) < 1e-9;
    if (!isHoriz && !isVert) continue;

    for (const obs of obstacles) {
      if (isHoriz) {
        const segY = p1.y;
        const segMinX = Math.min(p1.x, p2.x);
        const segMaxX = Math.max(p1.x, p2.x);
        if (segMaxX <= obs.x || segMinX >= obs.x + obs.width) continue;

        // L2 fixed distance sign: measure clearance outside top/bottom of obstacle.
        const distOutsideTop = obs.y - segY;
        const distOutsideBottom = segY - (obs.y + obs.height);

        let shift = 0;
        if (distOutsideTop >= 0 && distOutsideTop < margin) {
          shift = -(margin - distOutsideTop);
        } else if (distOutsideBottom >= 0 && distOutsideBottom < margin) {
          shift = margin - distOutsideBottom;
        } else if (segY > obs.y && segY < obs.y + obs.height) {
          // Segment penetrated obstacle: push to nearer clear side.
          const toTop = segY - obs.y + margin;
          const toBottom = (obs.y + obs.height) - segY + margin;
          shift = toTop <= toBottom ? -toTop : toBottom;
        }

        if (Math.abs(shift) > 1e-9 && !wouldHitObstacle(result, i, 'horizontal', shift, obstacles)) {
          result[i].y += shift;
          result[i + 1].y += shift;
        }
      } else {
        const segX = p1.x;
        const segMinY = Math.min(p1.y, p2.y);
        const segMaxY = Math.max(p1.y, p2.y);
        if (segMaxY <= obs.y || segMinY >= obs.y + obs.height) continue;

        const distOutsideLeft = obs.x - segX;
        const distOutsideRight = segX - (obs.x + obs.width);

        let shift = 0;
        if (distOutsideLeft >= 0 && distOutsideLeft < margin) {
          shift = -(margin - distOutsideLeft);
        } else if (distOutsideRight >= 0 && distOutsideRight < margin) {
          shift = margin - distOutsideRight;
        } else if (segX > obs.x && segX < obs.x + obs.width) {
          const toLeft = segX - obs.x + margin;
          const toRight = (obs.x + obs.width) - segX + margin;
          shift = toLeft <= toRight ? -toLeft : toRight;
        }

        if (Math.abs(shift) > 1e-9 && !wouldHitObstacle(result, i, 'vertical', shift, obstacles)) {
          result[i].x += shift;
          result[i + 1].x += shift;
        }
      }
    }
  }

  return result;
}

/**
 * Full simplification pipeline: merge collinear → parallel spacing → obstacle nudging.
 */
export function simplifyPaths(
  paths: Point[][],
  obstacles: Rect[],
  edgeSpacing: number,
  obstacleMargin: number,
  options?: SimplifyOptions,
): Point[][] {
  // Step 1: Merge collinear points in each path
  let result = paths.map(mergeCollinear);

  // Step 2: Space parallel segments (preserving endpoints when requested, clamping to obstacles)
  result = spaceParallelSegments(result, edgeSpacing, {
    preserveEndpoints: options?.preserveEndpoints ?? false,
    obstacles: options?.obstacles ?? obstacles,
  });

  // Step 3: Nudge away from obstacles (strictly interior segments only, fixed distance signs)
  result = nudgeAwayFromObstacles(result, options?.obstacles ?? obstacles, obstacleMargin);

  // Step 4: Final collinear merge (spacing/nudging may create new collinear runs)
  result = result.map(mergeCollinear);

  return result;
}
