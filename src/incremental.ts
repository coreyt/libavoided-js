import type {
  RouterInput,
  RouterOptions,
  RouterOutput,
  EdgeRequest,
  Point,
  Obstacle,
} from './types.js';
import { routeEdges } from './router.js';
import { pointEquals } from './geometry.js';

/**
 * Determine if an edge's topology has changed (different endpoints or obstacle layout).
 */
function edgeTopologyChanged(
  edge: EdgeRequest,
  previousEdge: EdgeRequest | undefined,
  currentObstacles: Obstacle[],
  previousObstacles: Obstacle[],
): boolean {
  if (!previousEdge) return true;

  // Endpoints changed
  if (!pointEquals(edge.sourcePoint, previousEdge.sourcePoint)) return true;
  if (!pointEquals(edge.targetPoint, previousEdge.targetPoint)) return true;

  // Port specs changed
  if (JSON.stringify(edge.sourcePort) !== JSON.stringify(previousEdge.sourcePort)) return true;
  if (JSON.stringify(edge.targetPort) !== JSON.stringify(previousEdge.targetPort)) return true;

  // Direction constraints changed
  if (edge.sourceDirection !== previousEdge.sourceDirection) return true;
  if (edge.targetDirection !== previousEdge.targetDirection) return true;

  // Obstacle count or identity changed
  if (currentObstacles.length !== previousObstacles.length) return true;

  // Check obstacle positions/sizes match
  const currentIds = new Set(currentObstacles.map((o) => o.id));
  const previousIds = new Set(previousObstacles.map((o) => o.id));

  for (const id of currentIds) {
    if (!previousIds.has(id)) return true;
  }

  for (const curr of currentObstacles) {
    const prev = previousObstacles.find((o) => o.id === curr.id);
    if (!prev) return true;
    if (curr.x !== prev.x || curr.y !== prev.y ||
        curr.width !== prev.width || curr.height !== prev.height) {
      return true;
    }
  }

  return false;
}

/**
 * Determine which obstacles changed between two inputs.
 */
function getChangedObstacleIds(
  current: Obstacle[],
  previous: Obstacle[],
): Set<string> {
  const changed = new Set<string>();
  const prevMap = new Map<string, Obstacle>();
  for (const o of previous) prevMap.set(o.id, o);
  const currMap = new Map<string, Obstacle>();
  for (const o of current) currMap.set(o.id, o);

  // Added or modified
  for (const curr of current) {
    const prev = prevMap.get(curr.id);
    if (!prev || curr.x !== prev.x || curr.y !== prev.y ||
        curr.width !== prev.width || curr.height !== prev.height) {
      changed.add(curr.id);
    }
  }

  // Removed
  for (const prev of previous) {
    if (!currMap.has(prev.id)) {
      changed.add(prev.id);
    }
  }

  return changed;
}

/**
 * Check if an edge's previous path passes near any of the changed obstacles.
 */
function edgeAffectedByObstacleChanges(
  path: Point[],
  changedObstacles: Set<string>,
  currentObstacles: Obstacle[],
  previousObstacles: Obstacle[],
  margin: number,
): boolean {
  if (changedObstacles.size === 0) return false;

  // Collect the bounding rects of all changed obstacles (both old and new positions)
  const affectedRects: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (const id of changedObstacles) {
    const curr = currentObstacles.find((o) => o.id === id);
    const prev = previousObstacles.find((o) => o.id === id);

    if (curr) {
      affectedRects.push({
        x: curr.x - margin, y: curr.y - margin,
        width: curr.width + margin * 2, height: curr.height + margin * 2,
      });
    }
    if (prev) {
      affectedRects.push({
        x: prev.x - margin, y: prev.y - margin,
        width: prev.width + margin * 2, height: prev.height + margin * 2,
      });
    }
  }

  // Check if any segment of the path intersects any affected rect
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const segMinX = Math.min(p1.x, p2.x);
    const segMaxX = Math.max(p1.x, p2.x);
    const segMinY = Math.min(p1.y, p2.y);
    const segMaxY = Math.max(p1.y, p2.y);

    for (const rect of affectedRects) {
      if (segMaxX >= rect.x && segMinX <= rect.x + rect.width &&
          segMaxY >= rect.y && segMinY <= rect.y + rect.height) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Route edges incrementally: reuse unchanged edges from previous result,
 * re-route only edges affected by topology changes.
 */
export function routeEdgesIncremental(
  input: RouterInput,
  previousInput: RouterInput | null,
  previousOutput: RouterOutput | null,
  options?: RouterOptions,
): RouterOutput {
  // No previous data — full route
  if (!previousInput || !previousOutput) {
    return routeEdges(input, options);
  }

  // Build lookup for previous edges and their results
  const previousEdgeMap = new Map<string, EdgeRequest>();
  for (const edge of previousInput.edges) {
    previousEdgeMap.set(edge.id, edge);
  }

  const previousResultMap = new Map<string, Point[]>();
  for (const routed of previousOutput.edges) {
    if (routed.sections.length > 0) {
      const section = routed.sections[0];
      const path = [section.startPoint, ...section.bendPoints, section.endPoint];
      previousResultMap.set(routed.id, path);
    }
  }

  // Determine which obstacles changed
  const changedObstacleIds = getChangedObstacleIds(input.obstacles, previousInput.obstacles);
  const obstaclesChanged = changedObstacleIds.size > 0;
  const margin = options?.obstacleMargin ?? 10;

  // Classify edges as changed or unchanged
  const changedEdgeIds = new Set<string>();
  const unchangedEdges = new Map<string, Point[]>();

  for (const edge of input.edges) {
    const prevEdge = previousEdgeMap.get(edge.id);

    // Check if edge's own topology changed
    const edgeChanged = edgeTopologyChanged(
      edge,
      prevEdge,
      input.obstacles,
      previousInput.obstacles,
    );

    if (edgeChanged) {
      changedEdgeIds.add(edge.id);
    } else if (obstaclesChanged) {
      // Edge itself didn't change, but check if its path is affected by obstacle changes
      const prevPath = previousResultMap.get(edge.id);
      if (prevPath && edgeAffectedByObstacleChanges(
        prevPath, changedObstacleIds, input.obstacles, previousInput.obstacles, margin,
      )) {
        changedEdgeIds.add(edge.id);
      } else if (prevPath) {
        unchangedEdges.set(edge.id, prevPath);
      } else {
        changedEdgeIds.add(edge.id);
      }
    } else {
      // No obstacles changed, edge didn't change — reuse
      const prevPath = previousResultMap.get(edge.id);
      if (prevPath) {
        unchangedEdges.set(edge.id, prevPath);
      } else {
        changedEdgeIds.add(edge.id);
      }
    }
  }

  // If nothing changed, return previous output in current edge order
  if (changedEdgeIds.size === 0) {
    return buildOutput(input.edges, unchangedEdges);
  }

  // If everything changed, do a full route
  if (changedEdgeIds.size === input.edges.length) {
    return routeEdges(input, options);
  }

  // Partial re-route: seed changed edges with previous paths
  const seededEdges = input.edges.map((e) => {
    const prevPath = previousResultMap.get(e.id);
    return prevPath ? { ...e, previousPath: prevPath } : e;
  });

  const fullInput = { obstacles: input.obstacles, edges: seededEdges };
  return routeEdges(fullInput, options);
}

function buildOutput(
  edges: EdgeRequest[],
  pathMap: Map<string, Point[]>,
): RouterOutput {
  return {
    edges: edges.map((edge) => {
      const path = pathMap.get(edge.id) || [edge.sourcePoint, edge.targetPoint];
      return {
        id: edge.id,
        sections: [
          {
            startPoint: path[0],
            endPoint: path[path.length - 1],
            bendPoints: path.slice(1, -1),
            incomingShape: edge.sourceId,
            outgoingShape: edge.targetId,
            routed: true,
          },
        ],
      };
    }),
  };
}
