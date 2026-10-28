"use client";

/**
 * The order of screens currently shown in the library grid, so the viewer's arrow keys
 * walk the same result set (filters, search and pages loaded so far). Lives in memory
 * only; a direct visit to a screen falls back to library order.
 */
let sequence: string[] = [];

export function setScreenSequence(ids: string[]) {
  sequence = ids;
}

export function neighborsInSequence(id: string): { prev: string | null; next: string | null; position: number; total: number } | null {
  const index = sequence.indexOf(id);
  if (index === -1) return null;
  return {
    prev: sequence[index - 1] ?? null,
    next: sequence[index + 1] ?? null,
    position: index + 1,
    total: sequence.length,
  };
}
