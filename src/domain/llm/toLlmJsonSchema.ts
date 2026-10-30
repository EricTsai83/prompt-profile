import { Schema } from "effect"

export type JsonSchemaNode = { readonly [key: string]: unknown }

/** Keywords allowed in LLM JSON Schemas (the subset both Claude and Codex strict mode accept). */
export const ALLOWED_KEYWORDS: ReadonlySet<string> = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "description",
])

const ALLOWED_TYPES: ReadonlySet<string> = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
])

const isObject = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u)

/** Replace `$ref: "#/$defs/X"` with the definition, recursively. */
const inlineRefs = (node: unknown, defs: Record<string, unknown>, seen: Set<string>): unknown => {
  if (Array.isArray(node)) return node.map((n) => inlineRefs(n, defs, seen))
  if (!isObject(node)) return node
  const ref = node["$ref"]
  if (typeof ref === "string") {
    const name = decodeURIComponent(ref.replace(/^#\/(\$defs|definitions)\//, ""))
    if (seen.has(name)) throw new Error(`Recursive schema cannot be inlined: ${name}`)
    const def = defs[name]
    if (def === undefined) throw new Error(`Unknown $ref: ${ref}`)
    return inlineRefs(def, defs, new Set([...seen, name]))
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, inlineRefs(v, defs, seen)]))
}

/**
 * `anyOf: [{type: "string"}, {type: "null"}]` → `type: ["string", "null"]`.
 * Effect emits `anyOf` for `NullOr`; the type-array form is accepted more widely.
 */
const collapseNullable = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(collapseNullable)
  if (!isObject(node)) return node
  const out: Record<string, unknown> = Object.fromEntries(
    Object.entries(node).map(([k, v]) => [k, collapseNullable(v)]),
  )
  const anyOf = out["anyOf"]
  if (
    Array.isArray(anyOf) &&
    anyOf.length === 2 &&
    anyOf.some((m) => isObject(m) && m["type"] === "null" && Object.keys(m).length === 1)
  ) {
    const other = anyOf.find((m) => !(isObject(m) && m["type"] === "null"))
    if (isObject(other) && typeof other["type"] === "string") {
      const { anyOf: _drop, ...rest } = out
      const merged: Record<string, unknown> = { ...rest, ...other, type: [other["type"], "null"] }
      if (Array.isArray(other["enum"])) merged["enum"] = [...other["enum"], null]
      return merged
    }
  }
  return out
}

/** Produce the JSON Schema sent to `claude --json-schema` / `codex --output-schema`. */
export const toLlmJsonSchema = (schema: Schema.Top): JsonSchemaNode => {
  const doc = Schema.toJsonSchemaDocument(Schema.toType(schema), { onExcessProperty: "error" })
  const inlined = inlineRefs(doc.schema, doc.definitions as Record<string, unknown>, new Set())
  const result = collapseNullable(inlined) as JsonSchemaNode
  const violations = validateLlmJsonSchema(result)
  if (violations.length > 0) {
    throw new Error(`Schema is not LLM-compatible:\n${violations.join("\n")}`)
  }
  return result
}

/** Walk a JSON Schema tree and return every violation of the LLM subset rules. */
export const validateLlmJsonSchema = (root: unknown): ReadonlyArray<string> => {
  const violations: Array<string> = []
  const visit = (node: unknown, path: string): void => {
    if (!isObject(node)) {
      violations.push(`${path}: schema must be an object`)
      return
    }
    for (const key of Object.keys(node)) {
      if (!ALLOWED_KEYWORDS.has(key)) violations.push(`${path}: forbidden keyword "${key}"`)
    }
    const type = node["type"]
    const types = Array.isArray(type) ? type : [type]
    if (type === undefined) violations.push(`${path}: missing "type"`)
    for (const t of types) {
      if (typeof t !== "string" || !ALLOWED_TYPES.has(t)) {
        violations.push(`${path}: unsupported type ${JSON.stringify(t)}`)
      }
    }
    if (types.includes("object")) {
      const props = node["properties"]
      if (!isObject(props)) {
        violations.push(`${path}: object without "properties"`)
      } else {
        if (node["additionalProperties"] !== false) {
          violations.push(`${path}: object must set additionalProperties: false`)
        }
        const required = node["required"]
        const keys = Object.keys(props)
        if (
          !Array.isArray(required) ||
          required.length !== keys.length ||
          !keys.every((k) => required.includes(k))
        ) {
          violations.push(`${path}: every property must be listed in "required"`)
        }
        for (const [k, v] of Object.entries(props)) visit(v, `${path}.properties.${k}`)
      }
    }
    if (types.includes("array")) {
      if (node["items"] === undefined) violations.push(`${path}: array without "items"`)
      else visit(node["items"], `${path}.items`)
    }
  }
  visit(root, "$")
  return violations
}
