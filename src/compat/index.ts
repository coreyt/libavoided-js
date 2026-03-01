/**
 * libavoid-compatible adapter layer.
 *
 * Provides an OOP facade with the same class names and method signatures
 * as libavoid's C++ orthogonal routing API. Delegates to the stateless
 * functional core internally.
 */

export {
  RouterFlag,
  ConnType,
  ConnDirFlag,
  RoutingParameter,
  RoutingOption,
} from './enums.js';

export { Polygon, PolyLine, Rectangle } from './types.js';
export type { Box, Checkpoint } from './types.js';

export { ConnEnd } from './conn-end.js';
export { ShapeRef } from './shape-ref.js';
export { ConnRef } from './conn-ref.js';
export { Router } from './router.js';
