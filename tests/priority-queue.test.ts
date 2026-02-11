import { describe, it, expect } from 'vitest';
import { PriorityQueue } from '../src/priority-queue.js';

describe('PriorityQueue', () => {
  it('starts empty', () => {
    const pq = new PriorityQueue<string>();
    expect(pq.isEmpty()).toBe(true);
    expect(pq.size).toBe(0);
  });

  it('pop returns undefined when empty', () => {
    const pq = new PriorityQueue<string>();
    expect(pq.pop()).toBeUndefined();
  });

  it('returns items in priority order', () => {
    const pq = new PriorityQueue<string>();
    pq.push('low', 10);
    pq.push('high', 1);
    pq.push('mid', 5);

    expect(pq.pop()).toBe('high');
    expect(pq.pop()).toBe('mid');
    expect(pq.pop()).toBe('low');
  });

  it('peek shows lowest priority without removing', () => {
    const pq = new PriorityQueue<number>();
    pq.push(42, 100);
    pq.push(7, 1);

    expect(pq.peek()).toBe(7);
    expect(pq.peekPriority()).toBe(1);
    expect(pq.size).toBe(2);
  });

  it('handles many items correctly', () => {
    const pq = new PriorityQueue<number>();
    const values = [50, 30, 70, 10, 90, 20, 80, 40, 60];
    for (const v of values) pq.push(v, v);

    const result: number[] = [];
    while (!pq.isEmpty()) result.push(pq.pop()!);

    expect(result).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('handles duplicate priorities', () => {
    const pq = new PriorityQueue<string>();
    pq.push('a', 5);
    pq.push('b', 5);
    pq.push('c', 5);

    const results = [pq.pop(), pq.pop(), pq.pop()];
    expect(results).toHaveLength(3);
    expect(results.sort()).toEqual(['a', 'b', 'c']);
  });
});
