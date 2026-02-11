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
| **Total** | | **89** |
