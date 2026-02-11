# Materials Log

All reference materials and concept sources used during development of `libavoided-js`. Organized by category.

---

## Public Algorithm References

| Concept | Source | Usage in Codebase |
|---------|--------|--------------------|
| A* search algorithm | Hart, P.E., Nilsson, N.J., Raphael, B. (1968). "A Formal Basis for the Heuristic Determination of Minimum Cost Paths." *IEEE Transactions on Systems Science and Cybernetics*, 4(2), 100-107. | `src/pathfinder.ts` — core pathfinding with directional state for bend penalty. |
| Hanan grid / rectilinear Steiner tree grid | Hanan, M. (1966). "On Steiner's Problem with Rectilinear Distance." *SIAM Journal on Applied Mathematics*, 14(2), 255-265. | `src/grid.ts` — sparse Manhattan grid constructed from obstacle boundary coordinates and edge anchors. |
| Binary min-heap | Standard CS data structure. See e.g. Cormen, T.H., Leiserson, C.E., Rivest, R.L., Stein, C. *Introduction to Algorithms* (CLRS), Chapter 6. | `src/priority-queue.ts` — priority queue for A* open set. |
| Manhattan distance (L1 metric) | Standard mathematical metric. | `src/geometry.ts` — heuristic for A* and edge sorting. |
| Orthogonal channel routing | Standard EDA (Electronic Design Automation) technique for routing rectilinear wires between components. General concept from VLSI design literature. | `src/grid.ts` — midpoint channel insertion between adjacent obstacle boundaries. |
| Visibility graph construction | Standard computational geometry concept for shortest path in polygonal domains. | `src/grid.ts` — scan-line adjacency connections along grid lines. |
| Axis-aligned bounding box (AABB) intersection | Standard computational geometry primitive. | `src/geometry.ts` — `segmentIntersectsRect`, `pointInRect`, `expandRect`. |
| Collinear point simplification | Standard polyline simplification technique. | `src/simplify.ts` — `mergeCollinear` removes redundant intermediate points. |
| Epsilon-based floating-point comparison | Standard numerical computing practice (machine epsilon guard). | `src/geometry.ts` — EPSILON = 1e-9 used throughout for coordinate comparisons. |

## Public Format References

| Format | Source | Usage in Codebase |
|--------|--------|--------------------|
| ELK (Eclipse Layout Kernel) JSON sections format | Public Eclipse Foundation documentation. ELK edge sections define `startPoint`, `endPoint`, `bendPoints`, `incomingShape`, `outgoingShape`. | `src/router.ts` — output format for `RoutedEdge.sections`. |

## Product Requirements

| Source | Description |
|--------|-------------|
| Coral internal product requirements | Defines the need for an orthogonal edge router compatible with the existing ELK-based layout pipeline. Specifies incremental routing, pinned waypoints, and tunable bend/crossing penalties as features. |

---

## Prohibited Sources — NOT Used

The following sources were **not** read, referenced, copied from, or provided in any AI prompt during development:

| Source | License | Status |
|--------|---------|--------|
| libavoid C++ source code (Adaptagrams project) | LGPL | **NOT USED** |
| libavoid test suites | LGPL | **NOT USED** |
| libavoid API documentation derived from source comments | LGPL | **NOT USED** |
| Any other LGPL-licensed routing implementation code | LGPL | **NOT USED** |
| Any proprietary routing library source code | Various | **NOT USED** |

---

## Notes

- All algorithms used are standard, well-known techniques documented in publicly available textbooks and academic papers.
- No third-party runtime dependencies are used. All algorithms were implemented from scratch.
- The ELK sections format was used for output compatibility; no ELK source code was referenced.
