import type {
  RouterInput,
  RouterOptions,
  RouterOutput,
  RoutedEdge,
  EdgeRequest,
  Point,
  Obstacle,
  CardinalDirection,
  PortSpec,
  RouterState,
} from './types.js';
import { DEFAULT_OPTIONS as DEFAULTS } from './types.js';
import { buildGrid, ensurePointInGrid, expandGridAroundPoints } from './grid.js';
import { findPath, RoutedSegments } from './pathfinder.js';
import { simplifyPaths } from './simplify.js';
import { manhattanDistance } from './geometry.js';

/**
 * Resolve a port spec to a concrete point and direction on an obstacle's boundary.
 */
function resolvePort(
  port: PortSpec,
  obstacle: Obstacle,
): { point: Point; direction: CardinalDirection } {
  const offset = port.offset ?? 0.5;
  switch (port.side) {
    case 'NORTH':
      return {
        point: { x: obstacle.x + obstacle.width * offset, y: obstacle.y },
        direction: 'up',
      };
    case 'SOUTH':
      return {
        point: { x: obstacle.x + obstacle.width * offset, y: obstacle.y + obstacle.height },
        direction: 'down',
      };
    case 'WEST':
      return {
        point: { x: obstacle.x, y: obstacle.y + obstacle.height * offset },
        direction: 'left',
      };
    case 'EAST':
      return {
        point: { x: obstacle.x + obstacle.width, y: obstacle.y + obstacle.height * offset },
        direction: 'right',
      };
  }
}

/**
 * Distribute multiple edges on the same port side of the same obstacle.
 * Evenly space them along the side instead of all going to the center.
 */
function distributePortOffsets(edges: EdgeRequest[], obstacles: Map<string, Obstacle>): EdgeRequest[] {
  // Group edges by (obstacleId, side, role) where role is 'source' or 'target'
  interface PortGroup {
    obstacleId: string;
    side: string;
    role: 'source' | 'target';
    edgeIndices: number[];
  }

  const groups = new Map<string, PortGroup>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (edge.sourcePort) {
      const key = `${edge.sourceId}:${edge.sourcePort.side}:source`;
      if (!groups.has(key)) {
        groups.set(key, { obstacleId: edge.sourceId, side: edge.sourcePort.side, role: 'source', edgeIndices: [] });
      }
      groups.get(key)!.edgeIndices.push(i);
    }
    if (edge.targetPort) {
      const key = `${edge.targetId}:${edge.targetPort.side}:target`;
      if (!groups.has(key)) {
        groups.set(key, { obstacleId: edge.targetId, side: edge.targetPort.side, role: 'target', edgeIndices: [] });
      }
      groups.get(key)!.edgeIndices.push(i);
    }
  }

  const result = edges.map((e) => ({ ...e }));

  for (const [, group] of groups) {
    if (group.edgeIndices.length <= 1) continue;

    const count = group.edgeIndices.length;
    for (let i = 0; i < count; i++) {
      const offset = (i + 1) / (count + 1);
      const idx = group.edgeIndices[i];

      if (group.role === 'source' && result[idx].sourcePort) {
        result[idx] = { ...result[idx], sourcePort: { ...result[idx].sourcePort!, offset } };
      } else if (group.role === 'target' && result[idx].targetPort) {
        result[idx] = { ...result[idx], targetPort: { ...result[idx].targetPort!, offset } };
      }
    }
  }

  return result;
}

/**
 * Resolve port specs on all edges, converting PortSpec to concrete sourcePoint/targetPoint.
 */
function resolveEdgePorts(edges: EdgeRequest[], obstacles: Obstacle[]): EdgeRequest[] {
  const obstacleMap = new Map<string, Obstacle>();
  for (const o of obstacles) {
    obstacleMap.set(o.id, o);
  }

  // Distribute offsets for multiple edges on same port side
  const distributed = distributePortOffsets(edges, obstacleMap);

  return distributed.map((edge) => {
    let result = { ...edge };

    if (edge.sourcePort) {
      const obs = obstacleMap.get(edge.sourceId);
      if (obs) {
        const resolved = resolvePort(edge.sourcePort, obs);
        result.sourcePoint = resolved.point;
        if (!result.sourceDirection) {
          result.sourceDirection = resolved.direction;
        }
      }
    }

    if (edge.targetPort) {
      const obs = obstacleMap.get(edge.targetId);
      if (obs) {
        const resolved = resolvePort(edge.targetPort, obs);
        result.targetPoint = resolved.point;
        if (!result.targetDirection) {
          result.targetDirection = resolved.direction;
        }
      }
    }

    return result;
  });
}

/**
 * Main routing pipeline: resolve ports → grid → route → simplify → format.
 */
export function routeEdges(
  input: RouterInput,
  options?: RouterOptions,
): RouterOutput {
  const opts = { ...DEFAULTS, ...options };

  const { obstacles, edges: rawEdges } = input;

  if (rawEdges.length === 0) {
    return { edges: [] };
  }

  // Resolve port specs to concrete points
  const edges = resolveEdgePorts(rawEdges, obstacles);

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
  const routeSuccess = new Map<string, boolean>();

  // Add pinned edge segments to crossing detection
  for (const edge of pinnedEdges) {
    const path = [edge.sourcePoint, ...edge.pinnedWaypoints!, edge.targetPoint];
    rawPaths.set(edge.id, path);
    routeSuccess.set(edge.id, true);
    routedSegments.addPath(path);
  }

  // Route non-pinned edges
  for (const edge of sortedEdges) {
    let path = findPath(
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

    if (!path) {
      // Retry: expand grid around source and target, then try again
      expandGridAroundPoints(grid, [edge.sourcePoint, edge.targetPoint], opts.obstacleMargin * 2);
      path = findPath(
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
    }

    if (path) {
      rawPaths.set(edge.id, path);
      routeSuccess.set(edge.id, true);
      routedSegments.addPath(path);
    } else {
      // Fallback: direct connection
      rawPaths.set(edge.id, [edge.sourcePoint, edge.targetPoint]);
      routeSuccess.set(edge.id, false);
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
    opts.centerInChannels,
  );

  // Merge back
  const finalPaths = [...pathsInOrder];
  for (let i = 0; i < nonPinnedIndices.length; i++) {
    finalPaths[nonPinnedIndices[i]] = simplifiedNonPinned[i];
  }

  // Build state for incremental reuse
  const edgePathMap = new Map<string, Point[]>();
  for (const edge of edges) {
    edgePathMap.set(edge.id, finalPaths[edges.indexOf(edge)]);
  }

  // Format output
  const routedEdges: RoutedEdge[] = edges.map((edge, i) => {
    const path = finalPaths[i];
    return formatEdge(edge, path, routeSuccess.get(edge.id) ?? false);
  });

  return {
    edges: routedEdges,
    _state: {
      gridVertexCount: grid.vertices.size,
      obstacles: [...grid.rawObstacles],
      edgePathMap,
    },
  };
}

function formatEdge(edge: EdgeRequest, path: Point[], routed: boolean): RoutedEdge {
  return {
    id: edge.id,
    sections: [
      {
        startPoint: path[0],
        endPoint: path[path.length - 1],
        bendPoints: path.slice(1, -1),
        incomingShape: edge.sourceId,
        outgoingShape: edge.targetId,
        routed,
      },
    ],
  };
}
