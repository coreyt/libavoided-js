# Router Behavior Specification

This document defines the behavioral contract of the `libavoided-js` orthogonal edge router. It describes **what** the router must do, not **how** it does it internally. All assertions here are verified by the test suite.

## 1. Input Contract

### 1.1 `RouterInput`

| Field       | Type           | Required | Description                              |
|-------------|----------------|----------|------------------------------------------|
| `obstacles` | `Obstacle[]`   | Yes      | Axis-aligned rectangles the router must avoid. |
| `edges`     | `EdgeRequest[]` | Yes     | Edges to route between obstacle anchor points. |

### 1.2 `Obstacle`

| Field    | Type     | Description                        |
|----------|----------|------------------------------------|
| `id`     | `string` | Unique identifier for the obstacle. |
| `x`      | `number` | Left edge x-coordinate.            |
| `y`      | `number` | Top edge y-coordinate.             |
| `width`  | `number` | Horizontal extent.                 |
| `height` | `number` | Vertical extent.                   |

Obstacles define axis-aligned bounding boxes. The router expands each obstacle by `obstacleMargin` on all sides to create a buffer zone that routed paths must not enter (except at designated anchor points).

### 1.3 `EdgeRequest`

| Field              | Type                           | Required | Description                                      |
|--------------------|--------------------------------|----------|--------------------------------------------------|
| `id`               | `string`                       | Yes      | Unique identifier for the edge.                  |
| `sourceId`         | `string`                       | Yes      | ID of the source obstacle/node.                  |
| `targetId`         | `string`                       | Yes      | ID of the target obstacle/node.                  |
| `sourcePoint`      | `Point`                        | Yes      | Exact coordinates where the edge exits the source. |
| `targetPoint`      | `Point`                        | Yes      | Exact coordinates where the edge enters the target. |
| `previousPath`     | `Point[]`                      | No       | Prior path used as a routing seed for incremental updates. |
| `pinnedWaypoints`  | `Point[]`                      | No       | User-specified waypoints that must be used verbatim. |
| `routingStyle`     | `'orthogonal' \| 'polyline'`   | No       | Per-edge routing style override (currently only `'orthogonal'` is implemented). |

### 1.4 `RouterOptions`

| Option            | Type     | Default | Description                                      |
|-------------------|----------|---------|--------------------------------------------------|
| `routingStyle`    | `string` | `'orthogonal'` | Global routing style.                      |
| `obstacleMargin`  | `number` | `10`    | Buffer distance around each obstacle.            |
| `edgeSpacing`     | `number` | `8`     | Minimum spacing between parallel overlapping edge segments. |
| `bendPenalty`      | `number` | `50`    | Cost added for each direction change in a path.  |
| `crossingPenalty`  | `number` | `200`   | Cost added for each crossing with a previously routed edge. |
| `lengthPenalty`    | `number` | `1`     | Multiplier applied to segment length in the cost function. |

### 1.5 `Point`

| Field | Type     | Description   |
|-------|----------|---------------|
| `x`   | `number` | X-coordinate. |
| `y`   | `number` | Y-coordinate. |

## 2. Output Contract

### 2.1 `RouterOutput`

| Field  | Type           | Description                        |
|--------|----------------|------------------------------------|
| `edges` | `RoutedEdge[]` | One entry per input `EdgeRequest`, in the same order. |

### 2.2 `RoutedEdge`

| Field      | Type       | Description                                 |
|------------|------------|---------------------------------------------|
| `id`       | `string`   | Matches the corresponding `EdgeRequest.id`. |
| `sections` | `Section[]` | ELK-compatible routing sections (always exactly one section per edge). |

### 2.3 `Section` (ELK-compatible)

| Field           | Type      | Description                                          |
|-----------------|-----------|------------------------------------------------------|
| `startPoint`    | `Point`   | First point of the path (equals `EdgeRequest.sourcePoint`). |
| `endPoint`      | `Point`   | Last point of the path (equals `EdgeRequest.targetPoint`).  |
| `bendPoints`    | `Point[]` | Intermediate waypoints between start and end.        |
| `incomingShape` | `string`  | Equals `EdgeRequest.sourceId`.                       |
| `outgoingShape` | `string`  | Equals `EdgeRequest.targetId`.                       |

The sections format is compatible with the ELK (Eclipse Layout Kernel) JSON edge representation.

## 3. Behavioral Invariants

### 3.1 Orthogonality

Every segment in a routed path must be axis-aligned: consecutive points differ in **either** x or y, never both. Formally, for consecutive points `p[i]` and `p[i+1]`:

```
|p[i+1].x - p[i].x| < epsilon  OR  |p[i+1].y - p[i].y| < epsilon
```

where epsilon = 1e-9.

### 3.2 Obstacle Avoidance

No segment of a routed path may pass through the interior of any obstacle. A horizontal segment at coordinate `y` intersects obstacle `O` if `O.y < y < O.y + O.height` and the segment's x-range overlaps `(O.x, O.x + O.width)`. Analogous for vertical segments. Border-touching is permitted; interior penetration is not.

### 3.3 Endpoint Preservation

The `startPoint` of each output section equals the `sourcePoint` of the corresponding input edge. The `endPoint` equals the `targetPoint`. The router must not modify these coordinates.

### 3.4 Pinned Waypoint Fidelity

When an edge specifies `pinnedWaypoints`, the output `bendPoints` must equal the pinned waypoints exactly. The router must not modify, reorder, or omit any pinned waypoint. Pinned edges bypass the pathfinding and simplification pipeline entirely.

### 3.5 Determinism

Given identical input (same obstacles, edges, and options), the router must produce identical output. There is no internal randomness.

### 3.6 Incremental Stability

When `routeEdgesIncremental` is called with unchanged topology (same obstacles, same edge endpoints), the output must be identical to the previous output. Unchanged edges are preserved verbatim; only edges with changed endpoints or obstacle layouts are re-routed.

### 3.7 Edge Ordering

Output edges appear in the same order as input edges, preserving the caller's ordering.

## 4. Default Option Values

When no `RouterOptions` are provided, these defaults apply:

```
routingStyle:    'orthogonal'
obstacleMargin:  10
edgeSpacing:     8
bendPenalty:     50
crossingPenalty: 200
lengthPenalty:   1
```

## 5. Error and Fallback Behavior

### 5.1 Empty Input

If `edges` is empty, the router returns `{ edges: [] }` immediately.

### 5.2 No Path Found

If the pathfinder cannot find a route between source and target (e.g., unreachable grid vertex), the router falls back to a direct two-point line: `[sourcePoint, targetPoint]`. This preserves endpoint correctness but may violate orthogonality or obstacle avoidance.

### 5.3 Same Source and Target

If `sourcePoint` equals `targetPoint`, the path is a single point `[sourcePoint]` with zero bend points.

### 5.4 Unreachable Grid Vertex

If a target point is not present in the routing grid, `findPath` returns `null` and the direct-line fallback applies.

## 6. Public API Surface

The library exports two routing functions:

- **`routeEdges(input, options?)`** — Full routing from scratch.
- **`routeEdgesIncremental(input, previousInput, previousOutput, options?)`** — Incremental routing that reuses unchanged edges.

And the following types: `Point`, `Obstacle`, `EdgeRequest`, `RouterOptions`, `RouterInput`, `RouterOutput`, `RoutedEdge`, `Rect`, `Segment`, `DEFAULT_OPTIONS`.
