/**
 * Enums matching libavoid's C++ API constants.
 */

/** Router type flag. */
export const enum RouterFlag {
  PolyLineRouting = 1,
  OrthogonalRouting = 2,
}

/** Connector type. */
export const enum ConnType {
  None = 0,
  PolyLine = 1,
  Orthogonal = 2,
}

/** Direction flags for connection endpoints. */
export const enum ConnDirFlag {
  None = 0,
  Up = 1,
  Down = 2,
  Left = 4,
  Right = 8,
  All = 15,
}

/** Indices into the routing parameter array. */
export const enum RoutingParameter {
  segmentPenalty = 0,
  anglePenalty = 1,
  crossingPenalty = 2,
  clusterCrossingPenalty = 3,
  fixedSharedPathPenalty = 4,
  portDirectionPenalty = 5,
  shapeBufferDistance = 6,
  idealNudgingDistance = 7,
}

/** Indices into the routing option array. */
export const enum RoutingOption {
  nudgeOrthogonalSegmentsConnectedToShapes = 0,
  improveHyperedgeRoutesMovingJunctions = 1,
  penaliseOrthogonalSharedPathsAtConnEnds = 2,
  nudgeOrthogonalTouchingColinearSegments = 3,
  performUnifyingNudgingPreprocessingStep = 4,
  improveHyperedgeRoutesMovingAddingAndDeletingJunctions = 5,
  nudgeSharedPathsWithCommonEndPoint = 6,
}
