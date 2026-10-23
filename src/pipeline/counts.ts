export type Counts = Record<string, number>

export const increment = (counts: Counts, key: string, by = 1): void => {
  counts[key] = (counts[key] ?? 0) + by
}
