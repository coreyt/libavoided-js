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
 * Route edges incrementally: reuse unchanged edges from previous result,
 * re-route only changed edges with previous paths as seeds.
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

  // Classify edges as changed or unchanged
  const changedEdges: EdgeRequest[] = [];
  const unchangedEdges = new Map<string, Point[]>();

  for (const edge of input.edges) {
    const prevEdge = previousEdgeMap.get(edge.id);
    const changed = edgeTopologyChanged(
      edge,
      prevEdge,
      input.obstacles,
      previousInput.obstacles,
    );

    if (changed) {
      // Seed from previous path if available
      const prevPath = previousResultMap.get(edge.id);
      changedEdges.push({
        ...edge,
        previousPath: prevPath || edge.previousPath,
      });
    } else {
      // Copy previous result directly
      const prevPath = previousResultMap.get(edge.id);
      if (prevPath) {
        unchangedEdges.set(edge.id, prevPath);
      } else {
        changedEdges.push(edge);
      }
    }
  }

  // If nothing changed, return previous output directly
  if (changedEdges.length === 0) {
    // Rebuild output in current edge order
    return buildOutput(input.edges, unchangedEdges);
  }

  // Route all edges (changed ones get previousPath seeding via the grid)
  const fullInput: RouterInput = {
    obstacles: input.obstacles,
    edges: input.edges.map((e) => {
      const prevPath = previousResultMap.get(e.id);
      return prevPath ? { ...e, previousPath: prevPath } : e;
    }),
  };

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
          },
        ],
      };
    }),
  };
}
