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

export interface EdgeRequest {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePoint: Point;
  targetPoint: Point;
  previousPath?: Point[];
  pinnedWaypoints?: Point[];
  routingStyle?: 'orthogonal' | 'polyline';
}

export interface RouterOptions {
  routingStyle?: 'orthogonal' | 'polyline';
  obstacleMargin?: number;
  edgeSpacing?: number;
  bendPenalty?: number;
  crossingPenalty?: number;
  lengthPenalty?: number;
}

export interface RouterInput {
  obstacles: Obstacle[];
  edges: EdgeRequest[];
}

export interface RoutedEdge {
  id: string;
  sections: Array<{
    startPoint: Point;
    endPoint: Point;
    bendPoints: Point[];
    incomingShape?: string;
    outgoingShape?: string;
  }>;
}

export interface RouterOutput {
  edges: RoutedEdge[];
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
};
