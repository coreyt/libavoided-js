# Test Matrix

Test scenarios and pass/fail criteria for `libavoided-js`. Maps to **89 tests** across **8 test files**.

---

## 1. Geometry Primitives — 28 tests

File: `tests/geometry.test.ts`

### pointEquals (3 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 1 | Identical points | Returns `true` for `(1,2)` vs `(1,2)`. |
| 2 | Different points | Returns `false` for `(1,2)` vs `(3,2)`. |
| 3 | Floating-point near-equality | Returns `true` when difference < 1e-9. |

### manhattanDistance (2 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 4 | Standard distance | `(0,0)` to `(3,4)` returns 7. |
| 5 | Same point | Returns 0 for identical points. |

### euclideanDistance (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 6 | 3-4-5 triangle | `(0,0)` to `(3,4)` returns 5. |

### expandRect (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 7 | Expand by margin | `{x:10,y:20,w:100,h:50}` expanded by 5 yields `{x:5,y:15,w:110,h:60}`. |

### pointInRect (3 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 8 | Interior point | Returns `true` for point strictly inside rect. |
| 9 | Exterior point | Returns `false` for point outside rect. |
| 10 | Border point | Returns `false` — borders are not considered interior. |

### pointOnRectBorder (3 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 11 | Left edge | Returns `true` for point on left edge. |
| 12 | Bottom edge | Returns `true` for point on bottom edge. |
| 13 | Interior point | Returns `false` — interior is not border. |

### segmentIntersectsRect (5 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 14 | Horizontal through rect | Returns `true`. |
| 15 | Horizontal above rect | Returns `false`. |
| 16 | Vertical through rect | Returns `true`. |
| 17 | Vertical left of rect | Returns `false`. |
| 18 | Touching border only | Returns `false` — border-touching is not intersection. |

### orthogonalSegmentsCross (4 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 19 | Crossing H+V segments | Returns `true` for perpendicular segments that cross at interior. |
| 20 | Parallel segments | Returns `false`. |
| 21 | T-junction (endpoint touching) | Returns `false` — endpoint touches are not crossings. |
| 22 | Non-overlapping perpendicular | Returns `false` — segments don't reach each other. |

### distanceToRect (2 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 23 | Point inside rect | Returns 0. |
| 24 | Point outside rect | Returns Euclidean distance to nearest edge. |

### areCollinear (3 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 25 | Horizontal collinear | Returns `true` for three points sharing same y. |
| 26 | Vertical collinear | Returns `true` for three points sharing same x. |
| 27 | Non-collinear | Returns `false` for points forming an angle. |

### pointKey / parsePointKey (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 28 | Roundtrip | `parsePointKey(pointKey({x:42,y:-17}))` equals original point. |

---

## 2. Priority Queue — 6 tests

File: `tests/priority-queue.test.ts`

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 29 | Starts empty | `isEmpty()` is `true`, `size` is 0. |
| 30 | Pop when empty | Returns `undefined`. |
| 31 | Priority ordering | Items popped in ascending priority order. |
| 32 | Peek without removal | `peek()` returns lowest-priority item; `size` unchanged. |
| 33 | Many items | 9 items inserted in random order; popped in sorted order. |
| 34 | Duplicate priorities | All items with same priority are returned (order unspecified). |

---

## 3. Grid Construction — 9 tests

File: `tests/grid.test.ts`

### buildGrid (7 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 35 | Single obstacle | Vertices exist; none inside expanded obstacle interior. |
| 36 | Anchor points in grid | Source and target points are present as grid vertices. |
| 37 | Midpoint channels | Midpoint x-coordinate between two obstacle boundaries exists as grid line. |
| 38 | Horizontal adjacency | Source vertex has at least one neighbor on same y-line. |
| 39 | No connection through obstacles | Source and target on opposite sides of wall are not directly connected. |
| 40 | Empty obstacle list | Grid still created with vertices from edge anchors. |
| 41 | Previous path points | Points from `previousPath` are added to the grid. |

### ensurePointInGrid (2 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 42 | New point insertion | Point added to grid with neighbors connected. |
| 43 | Existing point no-op | Grid size unchanged when point already exists. |

---

## 4. Pathfinding — 10 tests

File: `tests/pathfinder.test.ts`

### findPath (9 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 44 | Straight horizontal, no obstacles | Path from `(0,0)` to `(100,0)` found; endpoints match. |
| 45 | Straight vertical, no obstacles | Path found; all points share `x=0`. |
| 46 | Route around single obstacle | Path has bends; endpoints preserved. |
| 47 | Target not in grid | Returns `null`. |
| 48 | Same source and target | Returns single-point path. |
| 49 | Bend penalty preference | Higher bend penalty produces path with fewer or equal bends. |
| 50 | Crossing avoidance | Second edge routed with crossing penalty after first edge registered. |
| 51 | Orthogonal output | Every consecutive pair differs in x or y only (not both). |
| 52 | Multiple obstacles | Path found around two obstacles; endpoints preserved. |

### RoutedSegments (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 53 | Crossing count | Vertical segment crossing horizontal path counts 1; parallel counts 0. |

---

## 5. Simplification — 11 tests

File: `tests/simplify.test.ts`

### mergeCollinear (5 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 54 | Horizontal collinear removal | 3-point horizontal line reduced to 2 points. |
| 55 | Vertical collinear removal | 3-point vertical line reduced to 2 points. |
| 56 | Bend preservation | L-shaped 3-point path retains all 3 points. |
| 57 | Two-point path | Returned unchanged. |
| 58 | Multiple collinear in sequence | 5-point path with 4 collinear points reduced to 3. |

### spaceParallelSegments (3 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 59 | Overlapping horizontal segments | Two overlapping segments spaced apart by `edgeSpacing`. |
| 60 | Non-overlapping segments | Coordinates unchanged. |
| 61 | Single path | Coordinates unchanged. |

### nudgeAwayFromObstacles (2 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 62 | Bend near obstacle | Interior bend point pushed away; start/end unchanged. |
| 63 | Distant obstacle | No modification when obstacle is far away. |

### simplifyPaths (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 64 | Full pipeline | Collinear point `(25,0)` removed; endpoints preserved; length reduced. |

---

## 6. Router Pipeline — 9 tests

File: `tests/router.test.ts`

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 65 | Empty input | Returns `{ edges: [] }`. |
| 66 | Single edge, no obstacles | One edge returned with correct id, startPoint, endPoint, incomingShape, outgoingShape. |
| 67 | Edge around obstacle | Bend points present in output. |
| 68 | Pinned waypoints | Output bendPoints equal pinnedWaypoints exactly. |
| 69 | Multiple edges | Both edges present in output with correct ids. |
| 70 | Vertical straight line (same x) | All bend points share source x-coordinate. |
| 71 | Horizontal straight line (same y) | All bend points share source y-coordinate. |
| 72 | ELK sections shape | Output has `id`, `sections[]` with `startPoint`, `endPoint`, `bendPoints`, `incomingShape`, `outgoingShape`. |
| 73 | Custom options | Router accepts and uses non-default option values. |

---

## 7. Incremental Routing — 6 tests

File: `tests/incremental.test.ts`

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 74 | No previous data | Falls back to full routing; output correct. |
| 75 | Unchanged topology | Output matches first routing result exactly. |
| 76 | Endpoint change | Target moved; new endPoint reflects change. |
| 77 | Obstacle change | New obstacle added; bend points appear. |
| 78 | New edge added | Both old and new edges present in output. |
| 79 | Edge removed | Only remaining edge present in output. |

---

## 8. Integration Scenarios — 10 tests

File: `tests/integration.test.ts`

### Diamond graph (A->B, A->C, B->D, C->D) (3 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 80 | Routes all 4 edges | Output has 4 edges. |
| 81 | Orthogonal paths | Every segment axis-aligned across all 4 edges. |
| 82 | No obstacle penetration | No path segment passes through any of the 4 obstacle interiors. |

### Pinned edge (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 83 | Pinned waypoints preserved | bendPoints equal pinnedWaypoints; startPoint and endPoint match request. |

### Incremental stability (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 84 | Unchanged topology | Incremental result path-identical to initial full route. |

### ELK sections shape (1 test)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 85 | Format conformance | Section has `startPoint.{x,y}`, `endPoint.{x,y}`, `bendPoints[]`, `incomingShape`, `outgoingShape`. |

### Edge cases (4 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 86 | Side-by-side nodes | Edge routes between adjacent nodes; endpoints preserved. |
| 87 | Vertical straight line | All bend points share x-coordinate with source/target. |
| 88 | Horizontal straight line | All bend points share y-coordinate with source/target. |
| 89 | Edge behind obstacle | Path avoids obstacle interior; path is orthogonal. |

---

## 9. Property Tests — 63 tests

File: `tests/property.test.ts`

Tests behavioral invariants across 10 diverse fixtures. Each fixture runs `routeEdges` once in `beforeAll`, then checks 6 base invariants as separate `it` blocks. Fixtures with pinned edges or direction constraints add 1–2 additional tests.

**Fixtures (10):**

1. `no-obstacles-horizontal` — 0 obstacles, 1 horizontal edge
2. `no-obstacles-vertical` — 0 obstacles, 1 vertical edge
3. `no-obstacles-diagonal-endpoints` — 0 obstacles, 1 edge forcing L-shape
4. `single-obstacle-in-path` — 1 obstacle, 1 edge routed around it
5. `multiple-obstacles-corridor` — 3 obstacles, 1 edge through gaps
6. `adjacent-obstacles-narrow-gap` — 2 obstacles ~25px apart, 1 edge through gap
7. `multiple-edges-shared-source` — 1 obstacle, 3 edges with separate sources
8. `pinned-edge-mixed` — 1 obstacle, 1 pinned + 1 regular edge
9. `diamond-graph` — 4 obstacles, 4 edges
10. `direction-constrained` — 2 obstacles, 2 edges with sourceDirection/targetDirection

**Invariants checked per fixture:**

| # | Invariant | Applied to |
|---|-----------|------------|
| 1 | Orthogonality (all segments axis-aligned) | All fixtures |
| 2 | Obstacle avoidance (no path through interior) | All fixtures |
| 3 | Endpoint preservation (startPoint = sourcePoint, endPoint = targetPoint) | All fixtures |
| 4 | Edge count preservation (output count = input count) | All fixtures |
| 5 | Edge ordering (output ids match input ids in order) | All fixtures |
| 6 | Shape identity (incomingShape = sourceId, outgoingShape = targetId) | All fixtures |
| 7 | Pinned waypoint fidelity | Fixture 8 only |
| 8 | Direction constraint fidelity (first/last segment direction) | Fixture 10 only (2 tests) |

**Test count:** 10 × 6 base + 1 pinned + 2 direction = **63 tests**

---

## 10. Performance Tests — 7 tests

File: `tests/performance.test.ts`

Uses a `generateGridLayout(rows, cols)` helper to build grid-of-nodes fixtures with edges between adjacent nodes. Each node is 40×30 with 60px spacing.

| # | Scenario | Obstacles | Edges | Budget |
|---|----------|-----------|-------|--------|
| 90 | 3×3 grid | 9 | 12 | 50ms |
| 91 | 5×5 grid | 25 | 40 | 200ms |
| 92 | 8×8 grid | 64 | 112 | 500ms |
| 93 | 10×10 grid | 100 | 180 | 1000ms |
| 94 | 15×15 grid | 225 | 420 | 5000ms |
| 95 | 50 edges, no obstacles | 0 | 50 | 100ms |
| 96 | 50 obstacles, 1 edge | 50 | 1 | 100ms |

---

## 11. Determinism Tests — 11 tests

File: `tests/determinism.test.ts`

### N-run consistency (6 tests)

Run `routeEdges` 5× on identical input, assert all outputs deep-equal.

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 97 | Simple horizontal | 5 runs produce identical output. |
| 98 | Single obstacle | 5 runs produce identical output. |
| 99 | Diamond graph | 5 runs produce identical output. |
| 100 | Multiple crossing edges | 5 runs produce identical output. |
| 101 | Pinned edge | 5 runs produce identical output. |
| 102 | Custom options | 5 runs produce identical output with non-default options. |

### Incremental initial-run equivalence (3 tests)

Assert `routeEdgesIncremental(input, null, null)` equals `routeEdges(input)`.

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 103 | No obstacles | Incremental fallback equals full routing. |
| 104 | With obstacles | Incremental fallback equals full routing. |
| 105 | Diamond graph | Incremental fallback equals full routing. |

### Cross-invocation deep equality (2 tests)

| # | Scenario | Pass Criteria |
|---|----------|---------------|
| 106 | Structural deep-equal | Two invocations produce structurally equal (not reference-equal) output. |
| 107 | JSON.stringify identity | `JSON.stringify` of two invocations produces identical strings. |

---

## Summary

| Category | File | Tests |
|----------|------|-------|
| Geometry primitives | `tests/geometry.test.ts` | 28 |
| Priority queue | `tests/priority-queue.test.ts` | 6 |
| Grid construction | `tests/grid.test.ts` | 9 |
| Pathfinding | `tests/pathfinder.test.ts` | 10 |
| Simplification | `tests/simplify.test.ts` | 11 |
| Router pipeline | `tests/router.test.ts` | 9 |
| Incremental routing | `tests/incremental.test.ts` | 6 |
| Integration scenarios | `tests/integration.test.ts` | 10 |
| Property tests | `tests/property.test.ts` | 63 |
| Performance tests | `tests/performance.test.ts` | 7 |
| Determinism tests | `tests/determinism.test.ts` | 11 |
| **Total** | | **170** |
