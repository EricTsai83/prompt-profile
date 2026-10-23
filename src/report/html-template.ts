/** A value that is inserted without escaping. Only create it from trusted markup. */
export class Raw {
  constructor(readonly value: string) {}
}

export const raw = (value: string): Raw => new Raw(value)

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

type Value = string | number | boolean | null | undefined | Raw | ReadonlyArray<Value>

const render = (v: Value): string => {
  if (v === null || v === undefined || v === false) return ""
  if (v instanceof Raw) return v.value
  if (Array.isArray(v)) return v.map(render).join("")
  return escapeHtml(String(v))
}

/**
 * Tagged template that escapes every interpolation unless it is a `Raw` (e.g. the result of
 * another `html` call). Forgetting to escape is therefore impossible by construction.
 */
export const html = (strings: TemplateStringsArray, ...values: ReadonlyArray<Value>): Raw =>
  raw(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]!) : ""), ""))

/** JSON for embedding inside <script>: `<` is escaped so `</script>` can't end the tag. */
export const jsonForScript = (value: unknown): Raw =>
  raw(
    JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029"),
  )
