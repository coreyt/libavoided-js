import { describe, it, expect, beforeEach } from 'vitest';
import {
  Router,
  ShapeRef,
  ConnRef,
  ConnEnd,
  Rectangle,
  PolyLine,
  RouterFlag,
  ConnDirFlag,
  ConnType,
  RoutingParameter,
  RoutingOption,
} from '../../src/compat/index.js';
import { _resetShapeIdCounter } from '../../src/compat/shape-ref.js';
import { _resetConnIdCounter } from '../../src/compat/conn-ref.js';

/** Assert that every segment in the polyline is axis-aligned. */
function assertOrthogonal(route: PolyLine): void {
  for (let i = 1; i < route.ps.length; i++) {
    const dx = route.ps[i].x - route.ps[i - 1].x;
    const dy = route.ps[i].y - route.ps[i - 1].y;
    expect(
      dx === 0 || dy === 0,
      `Segment ${i - 1}-${i} is not orthogonal: dx=${dx}, dy=${dy}`,
    ).toBe(true);
  }
}

describe('compat integration', () => {
  beforeEach(() => {
    _resetShapeIdCounter();
    _resetConnIdCounter();
  });

  it('full lifecycle: create router, shapes, connector, process, read route', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);
    router.setRoutingParameter(RoutingParameter.shapeBufferDistance, 10);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 100, y: 60 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 300, y: 0 }, { x: 400, y: 60 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd({ x: 100, y: 30 }, ConnDirFlag.Right),
      new ConnEnd({ x: 300, y: 30 }, ConnDirFlag.Left),
    );

    const processed = router.processTransaction();
    expect(processed).toBe(true);

    const route = conn.route();
    expect(route).toBeInstanceOf(PolyLine);
    expect(route.size()).toBeGreaterThanOrEqual(2);
    expect(route.ps[0]).toEqual({ x: 100, y: 30 });
    expect(route.ps[route.ps.length - 1]).toEqual({ x: 300, y: 30 });
    assertOrthogonal(route);
  });

  it('routes multiple connectors', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 200, y: 100 }, { x: 250, y: 150 }),
    );

    const conn1 = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 200, y: 25 }),
    );
    const conn2 = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 200, y: 125 }),
    );

    router.processTransaction();

    expect(conn1.route().size()).toBeGreaterThanOrEqual(2);
    expect(conn2.route().size()).toBeGreaterThanOrEqual(2);
    assertOrthogonal(conn1.route());
    assertOrthogonal(conn2.route());
  });

  it('handles shape removal and re-routing', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
    );
    const obstacle = new ShapeRef(
      router,
      new Rectangle({ x: 100, y: 0 }, { x: 150, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 250, y: 0 }, { x: 300, y: 50 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 250, y: 25 }),
    );

    router.processTransaction();
    const routeWithObstacle = conn.route().ps.length;

    // Remove the obstacle and re-route.
    obstacle.remove();
    router.processTransaction();
    const routeWithout = conn.route().ps.length;

    // Without the obstacle, the route should be simpler (fewer or equal bends).
    expect(routeWithout).toBeLessThanOrEqual(routeWithObstacle);
  });

  it('connector removal prevents routing', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 200, y: 25 }),
    );

    conn.remove();
    expect(router.processTransaction()).toBe(false);
  });

  it('supports shape-attached ConnEnd', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);

    const s1 = new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 100, y: 60 }),
    );
    const s2 = new ShapeRef(
      router,
      new Rectangle({ x: 300, y: 0 }, { x: 400, y: 60 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd(s1, 1),
      new ConnEnd(s2, 1),
    );

    router.processTransaction();
    const route = conn.route();
    expect(route.size()).toBeGreaterThanOrEqual(2);
    assertOrthogonal(route);
  });

  it('supports fixed routes', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 200, y: 25 }),
    );

    const fixed = new PolyLine([
      { x: 50, y: 25 },
      { x: 125, y: 25 },
      { x: 125, y: 75 },
      { x: 200, y: 75 },
      { x: 200, y: 25 },
    ]);
    conn.setFixedRoute(fixed);

    router.processTransaction();
    // Fixed route should be preserved.
    expect(conn.route().ps).toEqual(fixed.ps);
  });

  it('supports checkpoints', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 300, y: 0 }, { x: 350, y: 50 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 300, y: 25 }),
    );

    // Checkpoint is passed as a pinned waypoint — it will be preserved
    // in the route. Verify it appears in the result.
    conn.setRoutingCheckpoints([{ point: { x: 175, y: 100 } }]);
    router.processTransaction();

    const route = conn.route();
    expect(route.size()).toBeGreaterThanOrEqual(2);
    // Pinned waypoints create non-orthogonal segments, so just verify
    // the checkpoint appears in the route.
    const hasCheckpoint = route.ps.some(
      (p) => p.x === 175 && p.y === 100,
    );
    expect(hasCheckpoint).toBe(true);
  });

  it('accepts PolyLineRouting flag (still routes orthogonally)', () => {
    const router = new Router(RouterFlag.PolyLineRouting);

    new ShapeRef(
      router,
      new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
    );
    new ShapeRef(
      router,
      new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
    );

    const conn = new ConnRef(
      router,
      new ConnEnd({ x: 50, y: 25 }),
      new ConnEnd({ x: 200, y: 25 }),
    );

    router.processTransaction();
    assertOrthogonal(conn.route());
  });

  it('stores unsupported parameters without error', () => {
    const router = new Router(RouterFlag.OrthogonalRouting);
    router.setRoutingParameter(RoutingParameter.anglePenalty, 999);
    router.setRoutingParameter(RoutingParameter.clusterCrossingPenalty, 1);
    router.setRoutingParameter(RoutingParameter.fixedSharedPathPenalty, 2);
    router.setRoutingParameter(RoutingParameter.portDirectionPenalty, 3);
    expect(router.routingParameter(RoutingParameter.anglePenalty)).toBe(999);

    router.setRoutingOption(RoutingOption.improveHyperedgeRoutesMovingJunctions, true);
    expect(router.routingOption(RoutingOption.improveHyperedgeRoutesMovingJunctions)).toBe(true);
  });

  it('all exports are accessible from the compat index', () => {
    // This test verifies that the index module re-exports everything.
    expect(Router).toBeDefined();
    expect(ShapeRef).toBeDefined();
    expect(ConnRef).toBeDefined();
    expect(ConnEnd).toBeDefined();
    expect(Rectangle).toBeDefined();
    expect(PolyLine).toBeDefined();
    expect(RouterFlag.OrthogonalRouting).toBe(2);
    expect(ConnDirFlag.All).toBe(15);
    expect(ConnType.Orthogonal).toBe(2);
    expect(RoutingParameter.segmentPenalty).toBe(0);
    expect(RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes).toBe(0);
  });
});
