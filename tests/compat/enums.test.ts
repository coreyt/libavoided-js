import { describe, it, expect } from 'vitest';
import {
  RouterFlag,
  ConnType,
  ConnDirFlag,
  RoutingParameter,
  RoutingOption,
} from '../../src/compat/enums.js';

describe('RouterFlag', () => {
  it('has correct values', () => {
    expect(RouterFlag.PolyLineRouting).toBe(1);
    expect(RouterFlag.OrthogonalRouting).toBe(2);
  });
});

describe('ConnType', () => {
  it('has correct values', () => {
    expect(ConnType.None).toBe(0);
    expect(ConnType.PolyLine).toBe(1);
    expect(ConnType.Orthogonal).toBe(2);
  });
});

describe('ConnDirFlag', () => {
  it('has correct values', () => {
    expect(ConnDirFlag.None).toBe(0);
    expect(ConnDirFlag.Up).toBe(1);
    expect(ConnDirFlag.Down).toBe(2);
    expect(ConnDirFlag.Left).toBe(4);
    expect(ConnDirFlag.Right).toBe(8);
    expect(ConnDirFlag.All).toBe(15);
  });

  it('All is the combination of all direction flags', () => {
    expect(ConnDirFlag.Up | ConnDirFlag.Down | ConnDirFlag.Left | ConnDirFlag.Right).toBe(
      ConnDirFlag.All,
    );
  });
});

describe('RoutingParameter', () => {
  it('has correct indices', () => {
    expect(RoutingParameter.segmentPenalty).toBe(0);
    expect(RoutingParameter.anglePenalty).toBe(1);
    expect(RoutingParameter.crossingPenalty).toBe(2);
    expect(RoutingParameter.clusterCrossingPenalty).toBe(3);
    expect(RoutingParameter.fixedSharedPathPenalty).toBe(4);
    expect(RoutingParameter.portDirectionPenalty).toBe(5);
    expect(RoutingParameter.shapeBufferDistance).toBe(6);
    expect(RoutingParameter.idealNudgingDistance).toBe(7);
  });
});

describe('RoutingOption', () => {
  it('has correct indices', () => {
    expect(RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes).toBe(0);
    expect(RoutingOption.improveHyperedgeRoutesMovingJunctions).toBe(1);
    expect(RoutingOption.penaliseOrthogonalSharedPathsAtConnEnds).toBe(2);
    expect(RoutingOption.nudgeOrthogonalTouchingColinearSegments).toBe(3);
    expect(RoutingOption.performUnifyingNudgingPreprocessingStep).toBe(4);
    expect(RoutingOption.improveHyperedgeRoutesMovingAddingAndDeletingJunctions).toBe(5);
    expect(RoutingOption.nudgeSharedPathsWithCommonEndPoint).toBe(6);
  });
});
