/** Longest skill description kept from any source's skill listing. */
const MAX_DESCRIPTION = 220

/** Clip a skill description to {@link MAX_DESCRIPTION} characters, ending with `…`. */
export const clipDescription = (value: string): string =>
  value.length > MAX_DESCRIPTION ? `${value.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : value
