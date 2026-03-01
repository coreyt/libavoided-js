import { describe, it, expect, beforeEach } from 'vitest';
import { ConnRef, _resetConnIdCounter } from '../../src/compat/conn-ref.js';
import { ConnEnd } from '../../src/compat/conn-end.js';
import { ConnType, ConnDirFlag, RouterFlag } from '../../src/compat/enums.js';
import { PolyLine } from '../../src/compat/types.js';
import { Router } from '../../src/compat/router.js';
import { _resetShapeIdCounter } from '../../src/compat/shape-ref.js';

describe('ConnRef', () => {
  let router: Router;
  let srcEnd: ConnEnd;
  let dstEnd: ConnEnd;

  beforeEach(() => {
    _resetShapeIdCounter();
    _resetConnIdCounter();
    router = new Router(RouterFlag.OrthogonalRouting);
    srcEnd = new ConnEnd({ x: 0, y: 0 });
    dstEnd = new ConnEnd({ x: 100, y: 100 });
  });

  it('auto-generates an id', () => {
    const c1 = new ConnRef(router, srcEnd, dstEnd);
    const c2 = new ConnRef(router, srcEnd, dstEnd);
    expect(c1.id()).not.toBe(c2.id());
  });

  it('accepts a manual id', () => {
    const c = new ConnRef(router, srcEnd, dstEnd, 99);
    expect(c.id()).toBe('99');
  });

  it('registers itself with the router', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(router.connectors().has(c)).toBe(true);
  });

  it('exposes endpoints', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(c.srcEnd()).toBe(srcEnd);
    expect(c.dstEnd()).toBe(dstEnd);
  });

  it('allows updating endpoints', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    const newSrc = new ConnEnd({ x: 50, y: 50 });
    c.setSourceEndpoint(newSrc);
    expect(c.srcEnd()).toBe(newSrc);

    const newDst = new ConnEnd({ x: 200, y: 200 });
    c.setDestEndpoint(newDst);
    expect(c.dstEnd()).toBe(newDst);
  });

  it('defaults to orthogonal routing type', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(c.routingType()).toBe(ConnType.Orthogonal);
  });

  it('allows changing routing type', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    c.setRoutingType(ConnType.PolyLine);
    expect(c.routingType()).toBe(ConnType.PolyLine);
  });

  it('route() returns empty PolyLine before processing', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(c.route()).toBeInstanceOf(PolyLine);
    expect(c.route().size()).toBe(0);
  });

  it('displayRoute() returns same as route()', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(c.displayRoute()).toBe(c.route());
  });

  it('supports fixed routes', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(c.hasFixedRoute()).toBe(false);

    const fixedPath = new PolyLine([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ]);
    c.setFixedRoute(fixedPath);
    expect(c.hasFixedRoute()).toBe(true);
    expect(c.route().ps).toEqual(fixedPath.ps);

    c.clearFixedRoute();
    expect(c.hasFixedRoute()).toBe(false);
  });

  it('fixed route is not overwritten by _setRoute', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    const fixedPath = new PolyLine([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
    c.setFixedRoute(fixedPath);

    const newPath = new PolyLine([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ]);
    c._setRoute(newPath);
    expect(c.route().ps).toEqual(fixedPath.ps);
  });

  it('supports checkpoints', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(c.routingCheckpoints()).toEqual([]);

    c.setRoutingCheckpoints([{ point: { x: 50, y: 50 } }]);
    expect(c.routingCheckpoints()).toEqual([{ point: { x: 50, y: 50 } }]);
  });

  it('remove() unregisters from router', () => {
    const c = new ConnRef(router, srcEnd, dstEnd);
    expect(router.connectors().has(c)).toBe(true);
    c.remove();
    expect(router.connectors().has(c)).toBe(false);
  });
});
