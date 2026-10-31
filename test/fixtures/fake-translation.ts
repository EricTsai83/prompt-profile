/** Structural test double only; authored translations test actual bilingual wording. */
export const fakeTranslation = <T>(value: T): T => {
  if (value === null) return value
  if (typeof value === "string") return `譯 ${value}` as T
  if (Array.isArray(value)) return value.map(fakeTranslation) as T
  if (typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, text]) => [key, key === "key" ? text : fakeTranslation(text)]),
  ) as T
}
