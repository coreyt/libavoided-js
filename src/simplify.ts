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

interface SegInfo {
  edgeIndex: number;
  segIndex: number;
  min: number;
  max: number;
  /** Midpoint of the segment's range along its primary axis */
  mid: number;
  /** Average position of source/target of this edge along the perpendicular axis */
  perpAvg: number;
}

/**
 * Space apart parallel edge segments that share the same line.
 * Uses topology-aware ordering: segments are sorted by the perpendicular position
 * of their edge's endpoints so edges going to similar destinations stay together.
 */
export function spaceParallelSegments(
  paths: Point[][],
  edgeSpacing: number,
): Point[][] {
  const result = paths.map((p) => p.map((pt) => ({ ...pt })));

  const groups = new Map<string, { orientation: 'horizontal' | 'vertical'; coordinate: number; segments: SegInfo[] }>();

  for (let eIdx = 0; eIdx < result.length; eIdx++) {
    const path = result[eIdx];
    // Compute perpendicular averages for ordering
    const sourcePoint = path[0];
    const targetPoint = path[path.length - 1];

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
      const mid = (min + max) / 2;

      // For horizontal segments, perpendicular axis is y → use average x of endpoints
      // For vertical segments, perpendicular axis is x → use average y of endpoints
      const perpAvg = isHoriz
        ? (sourcePoint.x + targetPoint.x) / 2
        : (sourcePoint.y + targetPoint.y) / 2;

      groups.get(key)!.segments.push({ edgeIndex: eIdx, segIndex: sIdx, min, max, mid, perpAvg });
    }
  }

  for (const [, group] of groups) {
    const multiEdgeSegs = group.segments.filter((seg) => {
      for (const other of group.segments) {
        if (other.edgeIndex === seg.edgeIndex) continue;
        if (other.min < seg.max - 1e-9 && other.max > seg.min + 1e-9) return true;
      }
      return false;
    });

    if (multiEdgeSegs.length <= 1) continue;

    const clusters = findOverlappingClusters(multiEdgeSegs);

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;

      // Deduplicate by edge
      const edgeSet = new Map<number, SegInfo>();
      for (const seg of cluster) {
        if (!edgeSet.has(seg.edgeIndex)) {
          edgeSet.set(seg.edgeIndex, seg);
        }
      }
      const uniqueByEdge = [...edgeSet.values()];
      if (uniqueByEdge.length <= 1) continue;

      // Sort by perpendicular average for topology-aware ordering
      uniqueByEdge.sort((a, b) => a.perpAvg - b.perpAvg);

      const totalSpread = (uniqueByEdge.length - 1) * edgeSpacing;

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
 * Shift a segment by offset in its perpendicular direction.
 */
function shiftSegment(
  path: Point[],
  segIndex: number,
  orientation: 'horizontal' | 'vertical',
  offset: number,
): void {
  if (orientation === 'horizontal') {
    path[segIndex].y += offset;
    path[segIndex + 1].y += offset;
  } else {
    path[segIndex].x += offset;
    path[segIndex + 1].x += offset;
  }
}

function findOverlappingClusters(
  segments: Array<SegInfo>,
): Array<SegInfo[]> {
  const sorted = [...segments].sort((a, b) => a.min - b.min);
  const clusters: Array<SegInfo[]> = [];

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

  for (let i = 0; i < result.length - 1; i++) {
    const p1 = result[i];
    const p2 = result[i + 1];

    const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
    const isVert = Math.abs(p1.x - p2.x) < 1e-9;
    if (!isHoriz && !isVert) continue;

    const p1IsEndpoint = i === 0;
    const p2IsEndpoint = i + 1 === result.length - 1;
    if (p1IsEndpoint && p2IsEndpoint) continue;

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
 * Center a single edge's segments within available channels between obstacles.
 * For each interior segment, find the nearest obstacles on both sides of its
 * perpendicular axis and shift the segment to the center of the gap.
 */
export function centerInChannels(
  paths: Point[][],
  obstacles: Rect[],
): Point[][] {
  return paths.map((path) => centerPathInChannels(path, obstacles));
}

function centerPathInChannels(path: Point[], obstacles: Rect[]): Point[] {
  if (path.length <= 4) return [...path]; // Need at least: start, bend, seg, bend, end

  const result = path.map((p) => ({ ...p }));

  for (let i = 1; i < result.length - 2; i++) {
    const p1 = result[i];
    const p2 = result[i + 1];

    // Verify this is a fully interior segment with perpendicular neighbors on both sides
    const prevPt = result[i - 1];
    const nextPt = result[i + 2];

    const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
    const isVert = Math.abs(p1.x - p2.x) < 1e-9;
    if (!isHoriz && !isVert) continue;

    // Check that the adjacent segments are perpendicular (not parallel)
    if (isHoriz) {
      // Previous segment (prevPt → p1) must be vertical
      if (Math.abs(prevPt.x - p1.x) > 1e-9) continue;
      // Next segment (p2 → nextPt) must be vertical
      if (Math.abs(p2.x - nextPt.x) > 1e-9) continue;
    } else {
      // Previous segment (prevPt → p1) must be horizontal
      if (Math.abs(prevPt.y - p1.y) > 1e-9) continue;
      // Next segment (p2 → nextPt) must be horizontal
      if (Math.abs(p2.y - nextPt.y) > 1e-9) continue;
    }

    if (isHoriz) {
      const segY = p1.y;
      const segMinX = Math.min(p1.x, p2.x);
      const segMaxX = Math.max(p1.x, p2.x);

      // Find nearest obstacle boundaries above and below
      let nearestAbove = -Infinity;
      let nearestBelow = Infinity;

      for (const obs of obstacles) {
        // Only consider obstacles whose x-range overlaps the segment
        if (obs.x + obs.width <= segMinX || obs.x >= segMaxX) continue;

        const bottom = obs.y + obs.height;
        if (bottom <= segY + 1e-9 && bottom > nearestAbove) {
          nearestAbove = bottom;
        }
        if (obs.y >= segY - 1e-9 && obs.y < nearestBelow) {
          nearestBelow = obs.y;
        }
      }

      if (nearestAbove > -Infinity && nearestBelow < Infinity) {
        const channelCenter = (nearestAbove + nearestBelow) / 2;
        const shift = channelCenter - segY;
        if (Math.abs(shift) > 1e-9) {
          result[i].y += shift;
          result[i + 1].y += shift;
        }
      }
    } else {
      const segX = p1.x;
      const segMinY = Math.min(p1.y, p2.y);
      const segMaxY = Math.max(p1.y, p2.y);

      let nearestLeft = -Infinity;
      let nearestRight = Infinity;

      for (const obs of obstacles) {
        if (obs.y + obs.height <= segMinY || obs.y >= segMaxY) continue;

        const right = obs.x + obs.width;
        if (right <= segX + 1e-9 && right > nearestLeft) {
          nearestLeft = right;
        }
        if (obs.x >= segX - 1e-9 && obs.x < nearestRight) {
          nearestRight = obs.x;
        }
      }

      if (nearestLeft > -Infinity && nearestRight < Infinity) {
        const channelCenter = (nearestLeft + nearestRight) / 2;
        const shift = channelCenter - segX;
        if (Math.abs(shift) > 1e-9) {
          result[i].x += shift;
          result[i + 1].x += shift;
        }
      }
    }
  }

  return result;
}

/**
 * Validate that no segment overlaps with an obstacle after nudging.
 * If a segment intersects an obstacle, clamp it to the nearest valid position.
 */
export function validateAgainstObstacles(
  paths: Point[][],
  obstacles: Rect[],
  margin: number,
): Point[][] {
  return paths.map((path) => validatePath(path, obstacles, margin));
}

function validatePath(path: Point[], obstacles: Rect[], margin: number): Point[] {
  if (path.length <= 2) return [...path];

  const result = path.map((p) => ({ ...p }));

  // Only validate fully interior segments (both points are internal bends,
  // not the first or last point of the path). Anchor points are allowed
  // to be inside expanded obstacles, so we must not shift them.
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

        if (segY > obs.y && segY < obs.y + obs.height) {
          const distToTop = segY - obs.y;
          const distToBottom = (obs.y + obs.height) - segY;
          const shift = distToTop < distToBottom
            ? -(distToTop + margin)
            : (distToBottom + margin);

          result[i].y += shift;
          result[i + 1].y += shift;
        }
      } else {
        const segX = p1.x;
        const segMinY = Math.min(p1.y, p2.y);
        const segMaxY = Math.max(p1.y, p2.y);
        if (segMaxY <= obs.y || segMinY >= obs.y + obs.height) continue;

        if (segX > obs.x && segX < obs.x + obs.width) {
          const distToLeft = segX - obs.x;
          const distToRight = (obs.x + obs.width) - segX;
          const shift = distToLeft < distToRight
            ? -(distToLeft + margin)
            : (distToRight + margin);

          result[i].x += shift;
          result[i + 1].x += shift;
        }
      }
    }
  }

  return result;
}

/**
 * Full simplification pipeline:
 * merge collinear → center in channels → parallel spacing → obstacle nudging → validate → merge.
 */
export function simplifyPaths(
  paths: Point[][],
  obstacles: Rect[],
  edgeSpacing: number,
  obstacleMargin: number,
  doCenterInChannels: boolean = true,
): Point[][] {
  // Step 1: Merge collinear points in each path
  let result = paths.map(mergeCollinear);

  // Step 2: Center single edges in channels between obstacles
  if (doCenterInChannels) {
    result = centerInChannels(result, obstacles);
  }

  // Step 3: Space parallel segments
  result = spaceParallelSegments(result, edgeSpacing);

  // Step 4: Nudge away from obstacles
  result = nudgeAwayFromObstacles(result, obstacles, obstacleMargin);

  // Step 5: Validate no segments now overlap obstacles
  result = validateAgainstObstacles(result, obstacles, obstacleMargin);

  // Step 6: Final collinear merge (spacing/nudging may create new collinear runs)
  result = result.map(mergeCollinear);

  return result;
}
