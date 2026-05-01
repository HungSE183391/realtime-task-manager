/**
 * Position helpers for drag-and-drop reorder using float "gap strategy".
 *
 * - New item at end: previousPosition + STEP (default 1024)
 * - New item between A and B: (A + B) / 2
 * - When gap shrinks below MIN_GAP, caller should rebalance the column.
 */
export const POSITION_STEP = 1024;
export const MIN_GAP = 0.0001;

export function positionForAppend(lastPosition: number | null | undefined): number {
  if (lastPosition == null) return POSITION_STEP;
  return lastPosition + POSITION_STEP;
}

export function positionBetween(
  before: number | null | undefined,
  after: number | null | undefined,
): number {
  if (before == null && after == null) return POSITION_STEP;
  if (before == null && after != null) return after / 2;
  if (before != null && after == null) return before + POSITION_STEP;
  return ((before as number) + (after as number)) / 2;
}

export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before == null || after == null) return false;
  return Math.abs(after - before) < MIN_GAP;
}

/**
 * Re-spreads positions evenly: 1*STEP, 2*STEP, 3*STEP, ...
 * Returns updates [{id, position}] caller can apply in a transaction.
 */
export function rebalancePositions<T extends { id: string }>(items: T[]): Array<{ id: string; position: number }> {
  return items.map((item, idx) => ({ id: item.id, position: (idx + 1) * POSITION_STEP }));
}
