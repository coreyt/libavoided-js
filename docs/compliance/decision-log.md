# Decision Log

Major algorithm and architecture decisions for `libavoided-js`, with rationale.

---

## 1. Sparse Manhattan Grid vs. Full Visibility Graph

**Decision:** Build a sparse grid from obstacle boundary coordinates and edge anchor points (Hanan-style), rather than a full visibility graph.

**Rationale:** For diagram-scale graphs (tens to low hundreds of obstacles), a Hanan grid produces O(k^2) vertices where k is the number of unique x/y coordinates. This is efficient and straightforward to implement. A full visibility graph would be more complex and unnecessary for the target use case.

**Location:** `src/grid.ts` — `buildGrid()`

---

## 2. A* with Directional State

**Decision:** Extend the A* search state to include the current travel direction, allowing bend penalties to be assessed during search rather than in post-processing.

**Rationale:** Standard A* on a grid graph treats all moves equally. By tracking direction as part of the state, the cost function naturally penalizes bends at expansion time, producing correct bend-minimized paths without a separate simplification pass. The state space increases by a constant factor (4 directions + "none" for start).

**Location:** `src/pathfinder.ts` — `AStarState`, `findPath()`

---

## 3. Sequential Greedy Routing (Shortest-First)

**Decision:** Route edges sequentially, shortest Manhattan distance first, rather than using global optimization.

**Rationale:** Global optimization (e.g., ILP-based or simultaneous routing) is computationally expensive and complex. Sequential greedy routing, prioritizing shorter (more constrained) edges first, is a pragmatic approach that produces good results for diagram layout. Previously routed edges influence later edges via crossing penalties.

**Location:** `src/router.ts` — edge sorting by `manhattanDistance` before routing loop

---

## 4. Multi-Objective Weighted Cost Function

**Decision:** Combine length, bend count, and crossing count into a single weighted cost via configurable penalties (`lengthPenalty`, `bendPenalty`, `crossingPenalty`).

**Rationale:** Different diagram styles have different priorities — some prefer minimal bends, others tolerate bends to avoid crossings. A tunable weighted sum lets callers control the tradeoff through `RouterOptions` without changing the algorithm. Default values (length=1, bend=50, crossing=200) prioritize crossing avoidance over bend minimization over raw length.

**Location:** `src/pathfinder.ts` — cost calculation in `findPath()`, `src/types.ts` — `DEFAULT_OPTIONS`

---

## 5. Three-Pass Simplification Pipeline

**Decision:** Post-process routed paths through three sequential passes: (1) collinear merge, (2) parallel segment spacing, (3) obstacle nudging, followed by a final collinear merge.

**Rationale:** Each pass addresses a distinct visual quality concern:
- **Collinear merge** removes redundant intermediate points left by the grid-based pathfinder.
- **Parallel spacing** separates overlapping edge segments from different edges for visual clarity.
- **Obstacle nudging** pushes segments that are too close to obstacle boundaries outward.

The passes are independent and composable. A final collinear merge cleans up any new collinear runs introduced by spacing or nudging.

**Location:** `src/simplify.ts` — `simplifyPaths()`, `mergeCollinear()`, `spaceParallelSegments()`, `nudgeAwayFromObstacles()`

---

## 6. Incremental Topology-Based Caching

**Decision:** For incremental routing, compare current and previous topology (obstacle positions + edge endpoints) to decide which edges need re-routing. Unchanged edges are copied verbatim; changed edges are re-routed with the previous path seeded into the grid.

**Rationale:** In interactive diagram editing, most updates change only one or a few edges. Re-routing everything from scratch causes visual instability (paths "jumping" between equivalent routes). By preserving unchanged edges and seeding changed edges from their prior paths, the router minimizes visual churn while still adapting to topology changes.

**Location:** `src/incremental.ts` — `routeEdgesIncremental()`, `edgeTopologyChanged()`

---

## 7. ELK Sections Output Format

**Decision:** Structure the output as ELK-compatible `sections[]` with `startPoint`, `endPoint`, `bendPoints`, `incomingShape`, and `outgoingShape`.

**Rationale:** The Coral application already uses ELK for layout. Matching the ELK edge sections format allows the routing output to be consumed directly by the existing rendering pipeline without format translation.

**Location:** `src/router.ts` — `formatEdge()`, `src/types.ts` — `RoutedEdge`

---

## 8. Zero Runtime Dependencies

**Decision:** Implement all algorithms (A*, binary heap, grid construction, simplification) from scratch with no third-party runtime dependencies.

**Rationale:** Eliminates license entanglement risk — every line of code has clear provenance under the project's own license. Also reduces bundle size and avoids supply-chain risk for a library intended to ship as part of a larger product.

**Location:** `package.json` — no `dependencies`; all source in `src/`

---

## 9. Anchor Points Override Expanded Obstacles

**Decision:** Edge source/target points (anchors) are always allowed in the routing grid, even when they fall inside the expanded obstacle margin zone.

**Rationale:** Anchors represent where edges connect to node borders. Since obstacles are expanded by `obstacleMargin` to create buffer zones, the actual node border lies inside the expanded rectangle. Anchors must be reachable for the pathfinder to connect edges to their designated start/end points.

**Location:** `src/grid.ts` — `anchorKeys` set, checked in `buildGrid()` vertex creation; `ensurePointInGrid()` — `connectAnchorToGrid()`

---

## 10. Epsilon-Based Floating-Point Geometry

**Decision:** Use a global epsilon of 1e-9 for all floating-point coordinate comparisons (equality, collinearity, intersection tests).

**Rationale:** Floating-point arithmetic can produce small rounding errors when coordinates are computed (e.g., midpoint channels, expanded rectangles). Without epsilon guards, these errors cause false negatives in equality checks and phantom grid disconnections. The value 1e-9 is small enough to avoid false positives for diagram-scale coordinates (typically in the range 0–10000) while absorbing IEEE 754 double-precision rounding.

**Location:** `src/geometry.ts` — `const EPSILON = 1e-9`, used in `pointEquals()`, `pointInRect()`, `segmentIntersectsRect()`, `orthogonalSegmentsCross()`, `areCollinear()`
