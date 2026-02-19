export interface Point {
  x: number;
  y: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export type PortSide = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export interface PortSpec {
  side: PortSide;
  offset?: number;  // 0-1 position along the side (default: 0.5 = center)
}

export interface EdgeRequest {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePoint: Point;
  targetPoint: Point;
  previousPath?: Point[];
  pinnedWaypoints?: Point[];
  routingStyle?: 'orthogonal' | 'polyline';
  sourceDirection?: CardinalDirection;
  targetDirection?: CardinalDirection;
  sourcePort?: PortSpec;
  targetPort?: PortSpec;
}

export interface RouterOptions {
  routingStyle?: 'orthogonal' | 'polyline';
  obstacleMargin?: number;
  edgeSpacing?: number;
  bendPenalty?: number;
  crossingPenalty?: number;
  lengthPenalty?: number;
  nudgeConnectedSegments?: boolean;
  centerInChannels?: boolean;
}

export interface RouterInput {
  obstacles: Obstacle[];
  edges: EdgeRequest[];
}

export interface EdgeSection {
  startPoint: Point;
  endPoint: Point;
  bendPoints: Point[];
  incomingShape?: string;
  outgoingShape?: string;
  routed: boolean;
}

export interface RoutedEdge {
  id: string;
  sections: EdgeSection[];
}

export interface RouterOutput {
  edges: RoutedEdge[];
  _state?: RouterState;
}

export interface RouterState {
  gridVertexCount: number;
  obstacles: Obstacle[];
  edgePathMap: Map<string, Point[]>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Segment {
  p1: Point;
  p2: Point;
}

export const DEFAULT_OPTIONS: Required<RouterOptions> = {
  routingStyle: 'orthogonal',
  obstacleMargin: 10,
  edgeSpacing: 8,
  bendPenalty: 50,
  crossingPenalty: 200,
  lengthPenalty: 1,
  nudgeConnectedSegments: true,
  centerInChannels: true,
};
