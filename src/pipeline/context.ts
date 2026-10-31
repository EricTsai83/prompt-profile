import { createHash } from "node:crypto"
import type { PromptRecord } from "../domain/PromptRecord.ts"

/** Local metadata selection. Raw paths never become report provenance. */
export const selectContext = (records: ReadonlyArray<PromptRecord>, selector: string) => {
  const match = /^(label|path):(.+)$/.exec(selector)
  if (!match || (match[1] === "path" && !match[2]!.startsWith("/")))
    throw new Error("Expected label:NAME or path:/absolute/path")
  const value = match[2]!
  const paths = [...new Set(records.flatMap((r) => (r.project === null ? [] : [r.project])))]
  const matches = paths.filter((p) =>
    match[1] === "path" ? p === value : p.split("/").at(-1) === value,
  )
  if (matches.length > 1) throw new Error("Project label is ambiguous; use an exact path selector")
  const path = matches[0]
  const selected = records.filter((r) => r.project !== null && r.project === path)
  const missing = records.filter((r) => r.project === null).length
  return {
    records: selected,
    coverage: {
      identity: createHash("sha256")
        .update(path ?? selector)
        .digest("hex"),
      selected: selected.length,
      missing,
      excluded: records.length - selected.length - missing,
    },
  }
}
