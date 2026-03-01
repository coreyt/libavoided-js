import { describe, it, expect, beforeEach } from 'vitest';
import { Router } from '../../src/compat/router.js';
import { ShapeRef, _resetShapeIdCounter } from '../../src/compat/shape-ref.js';
import { ConnRef, _resetConnIdCounter } from '../../src/compat/conn-ref.js';
import { ConnEnd } from '../../src/compat/conn-end.js';
import { Rectangle } from '../../src/compat/types.js';
import {
  RouterFlag,
  ConnDirFlag,
  RoutingParameter,
  RoutingOption,
} from '../../src/compat/enums.js';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    _resetShapeIdCounter();
    _resetConnIdCounter();
    router = new Router(RouterFlag.OrthogonalRouting);
  });

  it('stores router flag', () => {
    expect(router.flag()).toBe(RouterFlag.OrthogonalRouting);
  });

  it('stores and retrieves routing parameters', () => {
    router.setRoutingParameter(RoutingParameter.segmentPenalty, 42);
    expect(router.routingParameter(RoutingParameter.segmentPenalty)).toBe(42);

    router.setRoutingParameter(RoutingParameter.shapeBufferDistance, 15);
    expect(router.routingParameter(RoutingParameter.shapeBufferDistance)).toBe(15);
  });

  it('stores and retrieves routing options', () => {
    expect(router.routingOption(RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes)).toBe(
      false,
    );
    router.setRoutingOption(RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes, true);
    expect(router.routingOption(RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes)).toBe(true);
  });

  it('tracks shapes', () => {
    expect(router.shapes().size).toBe(0);
    const s = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }));
    expect(router.shapes().size).toBe(1);
    s.remove();
    expect(router.shapes().size).toBe(0);
  });

  it('tracks connectors', () => {
    expect(router.connectors().size).toBe(0);
    const c = new ConnRef(
      router,
      new ConnEnd({ x: 0, y: 0 }),
      new ConnEnd({ x: 100, y: 100 }),
    );
    expect(router.connectors().size).toBe(1);
    c.remove();
    expect(router.connectors().size).toBe(0);
  });

  describe('processTransaction', () => {
    it('returns false with no connectors', () => {
      new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }));
      expect(router.processTransaction()).toBe(false);
    });

    it('routes a simple connector between two shapes', () => {
      const s1 = new ShapeRef(
        router,
        new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
      );
      const s2 = new ShapeRef(
        router,
        new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
      );

      const conn = new ConnRef(
        router,
        new ConnEnd({ x: 50, y: 25 }),
        new ConnEnd({ x: 200, y: 25 }),
      );

      expect(router.processTransaction()).toBe(true);

      const route = conn.route();
      expect(route.size()).toBeGreaterThanOrEqual(2);
      // Start and end should match endpoints.
      expect(route.ps[0]).toEqual({ x: 50, y: 25 });
      expect(route.ps[route.ps.length - 1]).toEqual({ x: 200, y: 25 });
    });

    it('routes around obstacles', () => {
      // Source shape on the left.
      new ShapeRef(
        router,
        new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
      );
      // Target shape on the right.
      new ShapeRef(
        router,
        new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
      );
      // Obstacle in the middle.
      new ShapeRef(
        router,
        new Rectangle({ x: 100, y: 0 }, { x: 150, y: 50 }),
      );

      const conn = new ConnRef(
        router,
        new ConnEnd({ x: 50, y: 25 }),
        new ConnEnd({ x: 200, y: 25 }),
      );

      router.processTransaction();
      const route = conn.route();
      // Should have bends to go around the obstacle.
      expect(route.size()).toBeGreaterThan(2);

      // Verify orthogonality: each segment is horizontal or vertical.
      for (let i = 1; i < route.ps.length; i++) {
        const dx = route.ps[i].x - route.ps[i - 1].x;
        const dy = route.ps[i].y - route.ps[i - 1].y;
        expect(dx === 0 || dy === 0).toBe(true);
      }
    });

    it('respects direction constraints', () => {
      new ShapeRef(
        router,
        new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
      );
      new ShapeRef(
        router,
        new Rectangle({ x: 200, y: 200 }, { x: 250, y: 250 }),
      );

      const conn = new ConnRef(
        router,
        new ConnEnd({ x: 50, y: 25 }, ConnDirFlag.Right),
        new ConnEnd({ x: 200, y: 225 }, ConnDirFlag.Left),
      );

      router.processTransaction();
      const route = conn.route();
      expect(route.size()).toBeGreaterThanOrEqual(2);

      // First segment should go right (increasing x).
      expect(route.ps[1].x).toBeGreaterThan(route.ps[0].x);
      // Last segment should arrive from the left (increasing x).
      expect(route.ps[route.ps.length - 1].x).toBeGreaterThan(
        route.ps[route.ps.length - 2].x,
      );
    });

    it('applies routing parameters', () => {
      new ShapeRef(
        router,
        new Rectangle({ x: 0, y: 0 }, { x: 50, y: 50 }),
      );
      new ShapeRef(
        router,
        new Rectangle({ x: 200, y: 0 }, { x: 250, y: 50 }),
      );

      router.setRoutingParameter(RoutingParameter.shapeBufferDistance, 20);

      const conn = new ConnRef(
        router,
        new ConnEnd({ x: 50, y: 25 }),
        new ConnEnd({ x: 200, y: 25 }),
      );

      router.processTransaction();
      expect(conn.route().size()).toBeGreaterThanOrEqual(2);
    });
  });
});
