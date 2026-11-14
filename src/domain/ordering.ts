export interface Ordered {
  id: string;
  order: number;
}

/**
 * Move one item up (-1) or down (+1) in a list sorted by `order`.
 * Returns the full list renumbered 1..n in the new order. Unknown id or a move
 * past either end returns the list renumbered but otherwise unchanged.
 */
export function moveItem<T extends Ordered>(items: readonly T[], id: string, delta: -1 | 1): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i >= 0 && j >= 0 && j < sorted.length) {
    [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
  }
  return sorted.map((x, k) => ({ ...x, order: k + 1 }));
}

export function nextOrder(items: readonly Ordered[]): number {
  return items.reduce((m, x) => Math.max(m, x.order), 0) + 1;
}
