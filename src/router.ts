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
import { manhattanDistance } from './geometry.js';

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

  // Ensure all anchor points exist in the grid
  for (const edge of edges) {
    ensurePointInGrid(grid, edge.sourcePoint);
    ensurePointInGrid(grid, edge.targetPoint);
  }

  // Route each edge with A*
  const routedSegments = new RoutedSegments();
  const rawPaths = new Map<string, Point[]>();

  // Add pinned edge segments to crossing detection
  for (const edge of pinnedEdges) {
    const path = [edge.sourcePoint, ...edge.pinnedWaypoints!, edge.targetPoint];
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
    grid.expandedObstacles,
    opts.edgeSpacing,
    opts.obstacleMargin,
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
