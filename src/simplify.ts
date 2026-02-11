import type { Point, Rect } from './types.js';
import { areCollinear } from './geometry.js';

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
 * Space apart parallel edge segments that share the same line.
 * When multiple segments from different edges overlap on the same coordinate,
 * spread them by edgeSpacing. Maintains orthogonal consistency by adjusting
 * adjacent segments when a shared bend point is moved.
 */
export function spaceParallelSegments(
  paths: Point[][],
  edgeSpacing: number,
): Point[][] {
  const result = paths.map((p) => p.map((pt) => ({ ...pt })));

  // Collect all segments grouped by orientation + coordinate, but only from
  // different edges (don't spread segments from the same edge)
  interface SegInfo {
    edgeIndex: number;
    segIndex: number;
    min: number;
    max: number;
  }
  const groups = new Map<string, { orientation: 'horizontal' | 'vertical'; coordinate: number; segments: SegInfo[] }>();

  for (let eIdx = 0; eIdx < result.length; eIdx++) {
    const path = result[eIdx];
    for (let sIdx = 0; sIdx < path.length - 1; sIdx++) {
      const p1 = path[sIdx];
      const p2 = path[sIdx + 1];

      const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
      const isVert = Math.abs(p1.x - p2.x) < 1e-9;
      if (!isHoriz && !isVert) continue;

      const orientation = isHoriz ? 'horizontal' as const : 'vertical' as const;
      const coord = isHoriz ? p1.y : p1.x;
      const key = `${orientation}:${coord}`;

      if (!groups.has(key)) {
        groups.set(key, { orientation, coordinate: coord, segments: [] });
      }

      const min = isHoriz ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y);
      const max = isHoriz ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y);

      groups.get(key)!.segments.push({ edgeIndex: eIdx, segIndex: sIdx, min, max });
    }
  }

  for (const [, group] of groups) {
    // Only spread segments from different edges that overlap
    const byEdge = new Map<number, SegInfo[]>();
    for (const seg of group.segments) {
      if (!byEdge.has(seg.edgeIndex)) byEdge.set(seg.edgeIndex, []);
      byEdge.get(seg.edgeIndex)!.push(seg);
    }

    // Only consider clusters that contain segments from multiple edges
    const multiEdgeSegs = group.segments.filter((seg) => {
      // Check if any other edge has an overlapping segment
      for (const other of group.segments) {
        if (other.edgeIndex === seg.edgeIndex) continue;
        if (other.min < seg.max - 1e-9 && other.max > seg.min + 1e-9) return true;
      }
      return false;
    });

    if (multiEdgeSegs.length <= 1) continue;

    // Group overlapping segments across edges
    const clusters = findOverlappingClusters(multiEdgeSegs);

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;

      // Deduplicate by edge (take first segment per edge in the cluster)
      const edgeSet = new Map<number, SegInfo>();
      for (const seg of cluster) {
        if (!edgeSet.has(seg.edgeIndex)) {
          edgeSet.set(seg.edgeIndex, seg);
        }
      }
      const uniqueByEdge = [...edgeSet.values()];
      if (uniqueByEdge.length <= 1) continue;

      const totalSpread = (uniqueByEdge.length - 1) * edgeSpacing;
      const baseCoord = group.coordinate;

      for (let i = 0; i < uniqueByEdge.length; i++) {
        const offset = -totalSpread / 2 + i * edgeSpacing;
        if (Math.abs(offset) < 1e-9) continue;

        const seg = uniqueByEdge[i];
        const path = result[seg.edgeIndex];

        shiftSegment(path, seg.segIndex, group.orientation, offset);
      }
    }
  }

  return result;
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

function findOverlappingClusters(
  segments: Array<{ edgeIndex: number; segIndex: number; min: number; max: number }>,
): Array<typeof segments> {
  const sorted = [...segments].sort((a, b) => a.min - b.min);
  const clusters: Array<typeof segments> = [];

  let current = [sorted[0]];
  let currentMax = sorted[0].max;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min < currentMax - 1e-9) {
      current.push(sorted[i]);
      currentMax = Math.max(currentMax, sorted[i].max);
    } else {
      clusters.push(current);
      current = [sorted[i]];
      currentMax = sorted[i].max;
    }
  }
  clusters.push(current);

  return clusters;
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
  if (path.length <= 2) return [...path];

  const result = path.map((p) => ({ ...p }));

  // Process interior segments only (segments where both endpoints are interior points)
  // For segments touching start/end, only shift the interior endpoint
  for (let i = 0; i < result.length - 1; i++) {
    const p1 = result[i];
    const p2 = result[i + 1];

    const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
    const isVert = Math.abs(p1.x - p2.x) < 1e-9;
    if (!isHoriz && !isVert) continue;

    // Only nudge fully interior segments (neither endpoint is start or end of path)
    const p1IsEndpoint = i === 0;
    const p2IsEndpoint = i + 1 === result.length - 1;
    if (p1IsEndpoint && p2IsEndpoint) continue; // 2-point path, skip

    for (const obs of obstacles) {
      if (isHoriz) {
        const segY = p1.y;
        const segMinX = Math.min(p1.x, p2.x);
        const segMaxX = Math.max(p1.x, p2.x);
        if (segMaxX <= obs.x || segMinX >= obs.x + obs.width) continue;

        const distToTop = segY - obs.y;
        const distToBottom = (obs.y + obs.height) - segY;

        let shift = 0;
        if (distToTop > 0 && distToTop < margin) {
          shift = -(margin - distToTop);
        } else if (distToBottom > 0 && distToBottom < margin) {
          shift = margin - distToBottom;
        }

        if (Math.abs(shift) > 1e-9) {
          if (!p1IsEndpoint) result[i].y += shift;
          if (!p2IsEndpoint) result[i + 1].y += shift;
        }
      } else {
        const segX = p1.x;
        const segMinY = Math.min(p1.y, p2.y);
        const segMaxY = Math.max(p1.y, p2.y);
        if (segMaxY <= obs.y || segMinY >= obs.y + obs.height) continue;

        const distToLeft = segX - obs.x;
        const distToRight = (obs.x + obs.width) - segX;

        let shift = 0;
        if (distToLeft > 0 && distToLeft < margin) {
          shift = -(margin - distToLeft);
        } else if (distToRight > 0 && distToRight < margin) {
          shift = margin - distToRight;
        }

        if (Math.abs(shift) > 1e-9) {
          if (!p1IsEndpoint) result[i].x += shift;
          if (!p2IsEndpoint) result[i + 1].x += shift;
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
): Point[][] {
  // Step 1: Merge collinear points in each path
  let result = paths.map(mergeCollinear);

  // Step 2: Space parallel segments
  result = spaceParallelSegments(result, edgeSpacing);

  // Step 3: Nudge away from obstacles
  result = nudgeAwayFromObstacles(result, obstacles, obstacleMargin);

  // Step 4: Final collinear merge (spacing/nudging may create new collinear runs)
  result = result.map(mergeCollinear);

  return result;
}
