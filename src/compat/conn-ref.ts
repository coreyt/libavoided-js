/**
 * ConnRef — connector reference matching libavoid's API.
 */

import type { Point } from '../types.js';
import { ConnType } from './enums.js';
import { ConnEnd } from './conn-end.js';
import { PolyLine } from './types.js';
import type { Checkpoint } from './types.js';
import type { Router } from './router.js';

let nextConnId = 1;

export class ConnRef {
  private readonly _id: string;
  private _srcEnd: ConnEnd;
  private _dstEnd: ConnEnd;
  private _routingType: ConnType;
  private _router: Router;
  private _route: PolyLine;
  private _fixedRoute: boolean;
  private _checkpoints: Checkpoint[];

  constructor(router: Router, srcEnd: ConnEnd, dstEnd: ConnEnd, id?: number) {
    this._id = String(id ?? nextConnId++);
    this._srcEnd = srcEnd;
    this._dstEnd = dstEnd;
    this._routingType = ConnType.Orthogonal;
    this._router = router;
    this._route = new PolyLine();
    this._fixedRoute = false;
    this._checkpoints = [];
    router._addConnector(this);
  }

  /** Unique identifier for this connector. */
  id(): string {
    return this._id;
  }

  /** Source endpoint. */
  srcEnd(): ConnEnd {
    return this._srcEnd;
  }

  /** Destination endpoint. */
  dstEnd(): ConnEnd {
    return this._dstEnd;
  }

  /** Set new source endpoint. */
  setSourceEndpoint(end: ConnEnd): void {
    this._srcEnd = end;
  }

  /** Set new destination endpoint. */
  setDestEndpoint(end: ConnEnd): void {
    this._dstEnd = end;
  }

  /** Set the connector routing type. */
  setRoutingType(type: ConnType): void {
    this._routingType = type;
  }

  /** Get the connector routing type. */
  routingType(): ConnType {
    return this._routingType;
  }

  /** Get the computed route after processTransaction(). */
  route(): PolyLine {
    return this._route;
  }

  /** In libavoid, displayRoute() can differ from route(). Here they are the same. */
  displayRoute(): PolyLine {
    return this._route;
  }

  /**
   * Set a fixed (manually-specified) route for this connector.
   * The interior points become pinned waypoints during routing.
   */
  setFixedRoute(polyline: PolyLine): void {
    this._route = polyline;
    this._fixedRoute = true;
  }

  /** Whether this connector has a fixed route. */
  hasFixedRoute(): boolean {
    return this._fixedRoute;
  }

  /** Clear the fixed route, returning to automatic routing. */
  clearFixedRoute(): void {
    this._fixedRoute = false;
  }

  /** Set checkpoints for this connector. */
  setRoutingCheckpoints(checkpoints: Checkpoint[]): void {
    this._checkpoints = [...checkpoints];
  }

  /** Get checkpoints for this connector. */
  routingCheckpoints(): Checkpoint[] {
    return this._checkpoints;
  }

  /** Remove this connector from its router. */
  remove(): void {
    this._router._removeConnector(this);
  }

  /** @internal Called by Router to set the computed route. */
  _setRoute(polyline: PolyLine): void {
    if (!this._fixedRoute) {
      this._route = polyline;
    }
  }
}

/** Reset the auto-ID counter (for testing). */
export function _resetConnIdCounter(): void {
  nextConnId = 1;
}
