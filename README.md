# libavoided-js

Deterministic orthogonal edge router with obstacle avoidance. Zero dependencies.

## Install

```
npm install libavoided-js
```

## Quick Example

```ts
import { routeEdges } from 'libavoided-js';

const result = routeEdges({
  obstacles: [
    { id: 'A', x: 0, y: 0, width: 100, height: 60 },
    { id: 'B', x: 300, y: 0, width: 100, height: 60 },
  ],
  edges: [{
    id: 'e1',
    sourceId: 'A',
    targetId: 'B',
    sourcePoint: { x: 100, y: 30 },
    targetPoint: { x: 300, y: 30 },
  }],
}, {
  obstacleMargin: 10,
  bendPenalty: 50,
});

const section = result.edges[0].sections[0];
// section.startPoint, section.bendPoints, section.endPoint
```

## Compat API

An OOP adapter matching libavoid's class names and method signatures is available at `libavoided-js/compat`.

```ts
import {
  Router, ShapeRef, ConnRef, ConnEnd,
  Rectangle, RouterFlag, ConnDirFlag, RoutingParameter,
} from 'libavoided-js/compat';

const router = new Router(RouterFlag.OrthogonalRouting);
router.setRoutingParameter(RoutingParameter.shapeBufferDistance, 10);

const s1 = new ShapeRef(router, new Rectangle({ x: 0, y: 0 }, { x: 100, y: 60 }));
const s2 = new ShapeRef(router, new Rectangle({ x: 300, y: 0 }, { x: 400, y: 60 }));

const conn = new ConnRef(
  router,
  new ConnEnd({ x: 100, y: 30 }, ConnDirFlag.Right),
  new ConnEnd({ x: 300, y: 30 }, ConnDirFlag.Left),
);

router.processTransaction();

const route = conn.route(); // PolyLine
// route.ps → [{x, y}, ...]
```

## API Reference

### Core (`libavoided-js`)

#### `routeEdges(input, options?)`

Routes all edges, returning orthogonal paths that avoid obstacles.

- **input** — `{ obstacles: Obstacle[], edges: EdgeRequest[] }`
- **options** — `RouterOptions` (all optional)
- **returns** — `{ edges: RoutedEdge[] }`

#### `routeEdgesIncremental(input, previousInput, previousOutput, options?)`

Incremental routing that reuses unchanged edges from a previous result.

#### Types

| Type | Fields |
|------|--------|
| `Obstacle` | `id`, `x`, `y`, `width`, `height` |
| `EdgeRequest` | `id`, `sourceId`, `targetId`, `sourcePoint`, `targetPoint`, `sourceDirection?`, `targetDirection?`, `pinnedWaypoints?`, `previousPath?` |
| `RoutedEdge` | `id`, `sections[]` — each with `startPoint`, `endPoint`, `bendPoints[]`, `incomingShape`, `outgoingShape` |
| `CardinalDirection` | `'up' \| 'down' \| 'left' \| 'right'` |

#### `RouterOptions`

| Option | Default | Description |
|--------|---------|-------------|
| `obstacleMargin` | `10` | Buffer around obstacles |
| `edgeSpacing` | `8` | Space between parallel segments |
| `bendPenalty` | `50` | Cost per direction change |
| `crossingPenalty` | `200` | Cost per edge crossing |
| `lengthPenalty` | `1` | Cost multiplier for segment length |

### Compat (`libavoided-js/compat`)

OOP facade with libavoid-compatible class names.

| Class | Description |
|-------|-------------|
| `Router(flag)` | Main router. Call `processTransaction()` to route. |
| `ShapeRef(router, polygon)` | Obstacle shape. Auto-registers with router. |
| `ConnRef(router, srcEnd, dstEnd)` | Connector. Call `route()` after processing. |
| `ConnEnd(point, directions?)` | Connection endpoint with optional direction constraint. |
| `Rectangle(topLeft, bottomRight)` | Axis-aligned rectangle. |
| `Polygon(points?)` | Arbitrary polygon (bounding box used for routing). |
| `PolyLine(points?)` | Routed path result. |

| Enum | Values |
|------|--------|
| `RouterFlag` | `OrthogonalRouting = 2` |
| `ConnDirFlag` | `None`, `Up`, `Down`, `Left`, `Right`, `All` |
| `RoutingParameter` | `segmentPenalty`, `crossingPenalty`, `shapeBufferDistance`, `idealNudgingDistance`, ... |

## License

MIT
