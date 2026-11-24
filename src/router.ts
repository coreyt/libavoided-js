import type {
  RouterInput,
  RouterOptions,
  RouterOutput,
  RoutedEdge,
  EdgeRequest,
  Point,
} from './types.js';
import { DEFAULT_OPTIONS as DEFAULTS } from './types.js';
import { buildGrid, ensurePointInGrid } from './grid.js';
import { findPath, RoutedSegments } from './pathfinder.js';
import { simplifyPaths } from './simplify.js';
import { manhattanDistance, segmentIntersectsRect } from './geometry.js';

/**
 * Main routing pipeline: grid → route → simplify → format.
 */
export function routeEdges(
  input: RouterInput,
  options?: RouterOptions,
): RouterOutput {
  const opts = { ...DEFAULTS, ...options };

  const { obstacles, edges } = input;

  if (edges.length === 0) {
    return { edges: [] };
  }

  // Separate pinned edges from routable edges
  const pinnedEdges: EdgeRequest[] = [];
  const routableEdges: EdgeRequest[] = [];

  for (const edge of edges) {
    if (edge.pinnedWaypoints && edge.pinnedWaypoints.length > 0) {
      pinnedEdges.push(edge);
    } else {
      routableEdges.push(edge);
    }
  }

  // Sort routable edges by Manhattan distance (shorter first — more constrained)
  const sortedEdges = [...routableEdges].sort((a, b) => {
    const distA = manhattanDistance(a.sourcePoint, a.targetPoint);
    const distB = manhattanDistance(b.sourcePoint, b.targetPoint);
    return distA - distB;
  });

  // Build the grid
  const grid = buildGrid(obstacles, edges, opts.obstacleMargin);

  // Ensure all anchor points and pinned waypoints exist in the grid (L5 + L6)
  for (const edge of edges) {
    const exempt = new Set<string>([edge.sourceId, edge.targetId]);
    ensurePointInGrid(grid, edge.sourcePoint, exempt);
    ensurePointInGrid(grid, edge.targetPoint, exempt);
    if (edge.pinnedWaypoints) {
      for (const wp of edge.pinnedWaypoints) {
        ensurePointInGrid(grid, wp, exempt);
      }
    }
  }

  // Route each edge with A*
  const routedSegments = new RoutedSegments();
  const rawPaths = new Map<string, Point[]>();

  // Route pinned edges: preserve exact waypoints, routing around obstacles on any blocked leg (L5)
  for (const edge of pinnedEdges) {
    const checkpoints = [edge.sourcePoint, ...edge.pinnedWaypoints!, edge.targetPoint];
    const thirdPartyObstacles = obstacles.filter((o) => o.id !== edge.sourceId && o.id !== edge.targetId);
    const hasBlockedLeg = checkpoints.some((pt, idx) => idx < checkpoints.length - 1
      && thirdPartyObstacles.some((obs) => segmentIntersectsRect({ p1: pt, p2: checkpoints[idx + 1] }, obs)));

    let path: Point[];
    if (!hasBlockedLeg) {
      path = checkpoints;
    } else {
      path = [checkpoints[0]];
      for (let i = 0; i < checkpoints.length - 1; i++) {
        const legStart = checkpoints[i];
        const legEnd = checkpoints[i + 1];
        const blocked = thirdPartyObstacles.some((obs) => segmentIntersectsRect({ p1: legStart, p2: legEnd }, obs));
        if (!blocked) {
          path.push(legEnd);
        } else {
          const routedLeg = findPath(
            grid,
            legStart,
            legEnd,
            {
              bendPenalty: opts.bendPenalty,
              crossingPenalty: opts.crossingPenalty,
              lengthPenalty: opts.lengthPenalty,
              sharedSegmentPenalty: opts.sharedSegmentPenalty,
              sourceDirection: i === 0 ? edge.sourceDirection : undefined,
              targetDirection: i === checkpoints.length - 2 ? edge.targetDirection : undefined,
            },
            routedSegments,
          );
          if (routedLeg && routedLeg.length >= 2) {
            path.push(...routedLeg.slice(1));
          } else {
            path.push(legEnd);
          }
        }
      }
    }
    rawPaths.set(edge.id, path);
    routedSegments.addPath(path);
  }

  // Route non-pinned edges
  for (const edge of sortedEdges) {
    const path = findPath(
      grid,
      edge.sourcePoint,
      edge.targetPoint,
      {
        bendPenalty: opts.bendPenalty,
        crossingPenalty: opts.crossingPenalty,
        lengthPenalty: opts.lengthPenalty,
        sharedSegmentPenalty: opts.sharedSegmentPenalty,
        sourceDirection: edge.sourceDirection,
        targetDirection: edge.targetDirection,
      },
      routedSegments,
    );

    if (path) {
      rawPaths.set(edge.id, path);
      routedSegments.addPath(path);
    } else {
      // Fallback: direct connection
      rawPaths.set(edge.id, [edge.sourcePoint, edge.targetPoint]);
    }
  }

  // Collect paths in original edge order for simplification
  const pathsInOrder = edges.map((e) => rawPaths.get(e.id) || [e.sourcePoint, e.targetPoint]);

  // Identify which edges are pinned (skip simplification for those)
  const pinnedIds = new Set(pinnedEdges.map((e) => e.id));

  // Simplify non-pinned paths
  const nonPinnedIndices: number[] = [];
  const nonPinnedPaths: Point[][] = [];

  for (let i = 0; i < edges.length; i++) {
    if (!pinnedIds.has(edges[i].id)) {
      nonPinnedIndices.push(i);
      nonPinnedPaths.push(pathsInOrder[i]);
    }
  }

  const simplifiedNonPinned = simplifyPaths(
    nonPinnedPaths,
    obstacles,
    opts.edgeSpacing,
    opts.obstacleMargin,
    { preserveEndpoints: opts.preserveEndpoints, obstacles },
  );

  // Merge back
  const finalPaths = [...pathsInOrder];
  for (let i = 0; i < nonPinnedIndices.length; i++) {
    finalPaths[nonPinnedIndices[i]] = simplifiedNonPinned[i];
  }

  // Format output
  const routedEdges: RoutedEdge[] = edges.map((edge, i) => {
    const path = finalPaths[i];
    return formatEdge(edge, path);
  });

  return { edges: routedEdges };
}

function formatEdge(edge: EdgeRequest, path: Point[]): RoutedEdge {
  return {
    id: edge.id,
    sections: [
      {
        startPoint: path[0],
        endPoint: path[path.length - 1],
        bendPoints: path.slice(1, -1),
        incomingShape: edge.sourceId,
        outgoingShape: edge.targetId,
      },
    ],
  };
}
