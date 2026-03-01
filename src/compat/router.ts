/**
 * Router — main facade matching libavoid's Router API.
 *
 * Accumulates shapes and connectors, then delegates to the
 * functional core on processTransaction().
 */

import { routeEdges } from '../router.js';
import { routeEdgesIncremental } from '../incremental.js';
import type {
  CardinalDirection,
  EdgeRequest,
  Obstacle,
  Point,
  RouterInput,
  RouterOptions,
  RouterOutput,
} from '../types.js';
import {
  ConnDirFlag,
  RoutingOption,
  RoutingParameter,
  type RouterFlag,
} from './enums.js';
import { PolyLine } from './types.js';
import type { ShapeRef } from './shape-ref.js';
import type { ConnRef } from './conn-ref.js';

export class Router {
  private readonly _flag: RouterFlag;
  private readonly _shapes: Set<ShapeRef> = new Set();
  private readonly _connectors: Set<ConnRef> = new Set();
  private readonly _parameters: number[] = new Array(8).fill(0);
  private readonly _options: boolean[] = new Array(7).fill(false);

  private _prevInput: RouterInput | null = null;
  private _prevOutput: RouterOutput | null = null;

  constructor(flag: RouterFlag) {
    this._flag = flag;
  }

  /** The router flag this instance was created with. */
  flag(): RouterFlag {
    return this._flag;
  }

  // --- Parameter / option storage ---

  /** Set a routing parameter value. */
  setRoutingParameter(param: RoutingParameter, value: number): void {
    this._parameters[param] = value;
  }

  /** Get a routing parameter value. */
  routingParameter(param: RoutingParameter): number {
    return this._parameters[param];
  }

  /** Set a routing option value. */
  setRoutingOption(option: RoutingOption, value: boolean): void {
    this._options[option] = value;
  }

  /** Get a routing option value. */
  routingOption(option: RoutingOption): boolean {
    return this._options[option];
  }

  // --- Shape / connector management (called by constructors) ---

  /** @internal */
  _addShape(shape: ShapeRef): void {
    this._shapes.add(shape);
    this._invalidateIncremental();
  }

  /** @internal */
  _removeShape(shape: ShapeRef): void {
    this._shapes.delete(shape);
    this._invalidateIncremental();
  }

  /** @internal */
  _addConnector(conn: ConnRef): void {
    this._connectors.add(conn);
  }

  /** @internal */
  _removeConnector(conn: ConnRef): void {
    this._connectors.delete(conn);
  }

  /** All currently registered shapes. */
  shapes(): ReadonlySet<ShapeRef> {
    return this._shapes;
  }

  /** All currently registered connectors. */
  connectors(): ReadonlySet<ConnRef> {
    return this._connectors;
  }

  // --- Transaction processing ---

  /**
   * Route all connectors, distributing results back to each ConnRef.
   * Returns `true` if routing was performed.
   */
  processTransaction(): boolean {
    if (this._connectors.size === 0) {
      return false;
    }

    const obstacles = this._buildObstacles();
    const edges = this._buildEdges(obstacles);

    if (edges.length === 0) {
      return false;
    }

    const input: RouterInput = { obstacles, edges };
    const options = this._buildOptions();

    let output: RouterOutput;
    if (this._prevInput && this._prevOutput) {
      output = routeEdgesIncremental(
        input,
        this._prevInput,
        this._prevOutput,
        options,
      );
    } else {
      output = routeEdges(input, options);
    }

    this._prevInput = input;
    this._prevOutput = output;

    // Distribute results back to ConnRefs.
    const routeById = new Map(output.edges.map((e) => [e.id, e]));
    for (const conn of this._connectors) {
      const routed = routeById.get(conn.id());
      if (routed && routed.sections.length > 0) {
        const section = routed.sections[0];
        const points: Point[] = [
          section.startPoint,
          ...section.bendPoints,
          section.endPoint,
        ];
        conn._setRoute(new PolyLine(points));
      }
    }

    return true;
  }

  // --- Private helpers ---

  private _invalidateIncremental(): void {
    this._prevInput = null;
    this._prevOutput = null;
  }

  private _buildObstacles(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    for (const shape of this._shapes) {
      const box = shape.polygon().boundingBox();
      obstacles.push({
        id: shape.id(),
        x: box.min.x,
        y: box.min.y,
        width: box.max.x - box.min.x,
        height: box.max.y - box.min.y,
      });
    }
    return obstacles;
  }

  private _buildEdges(obstacles: Obstacle[]): EdgeRequest[] {
    const edges: EdgeRequest[] = [];

    for (const conn of this._connectors) {
      const src = conn.srcEnd();
      const dst = conn.dstEnd();
      const srcPoint = src.point();
      const dstPoint = dst.point();

      // Infer containing shape by checking if the point is inside an obstacle.
      const sourceId = src.shape()?.id() ?? this._findContainingShape(srcPoint, obstacles) ?? '';
      const targetId = dst.shape()?.id() ?? this._findContainingShape(dstPoint, obstacles) ?? '';

      const edge: EdgeRequest = {
        id: conn.id(),
        sourceId,
        targetId,
        sourcePoint: srcPoint,
        targetPoint: dstPoint,
      };

      // Direction constraints (single flag only).
      const srcDir = flagToDirection(src.directions());
      if (srcDir) edge.sourceDirection = srcDir;
      const dstDir = flagToDirection(dst.directions());
      if (dstDir) edge.targetDirection = dstDir;

      // Fixed route → pinned waypoints (interior points).
      if (conn.hasFixedRoute()) {
        const pts = conn.route().ps;
        if (pts.length > 2) {
          edge.pinnedWaypoints = pts.slice(1, -1);
        }
      } else if (conn.routingCheckpoints().length > 0) {
        edge.pinnedWaypoints = conn.routingCheckpoints().map((cp) => cp.point);
      }

      edges.push(edge);
    }

    return edges;
  }

  private _buildOptions(): RouterOptions {
    const options: RouterOptions = {};
    const seg = this._parameters[RoutingParameter.segmentPenalty];
    if (seg) options.bendPenalty = seg;
    const cross = this._parameters[RoutingParameter.crossingPenalty];
    if (cross) options.crossingPenalty = cross;
    const buffer = this._parameters[RoutingParameter.shapeBufferDistance];
    if (buffer) options.obstacleMargin = buffer;
    const nudge = this._parameters[RoutingParameter.idealNudgingDistance];
    if (nudge) options.edgeSpacing = nudge;
    return options;
  }

  private _findContainingShape(
    point: Point,
    obstacles: Obstacle[],
  ): string | undefined {
    for (const obs of obstacles) {
      if (
        point.x >= obs.x &&
        point.x <= obs.x + obs.width &&
        point.y >= obs.y &&
        point.y <= obs.y + obs.height
      ) {
        return obs.id;
      }
    }
    return undefined;
  }
}

/** Map a single ConnDirFlag to a CardinalDirection, or undefined if multi/none. */
function flagToDirection(flag: ConnDirFlag): CardinalDirection | undefined {
  switch (flag) {
    case ConnDirFlag.Up:
      return 'up';
    case ConnDirFlag.Down:
      return 'down';
    case ConnDirFlag.Left:
      return 'left';
    case ConnDirFlag.Right:
      return 'right';
    default:
      return undefined;
  }
}
