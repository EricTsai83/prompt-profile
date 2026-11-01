/** Longest skill description kept from any source's skill listing. */
const MAX_DESCRIPTION = 220

/** Clip a skill description to {@link MAX_DESCRIPTION} characters, ending with `…`. */
export const clipDescription = (value: string): string =>
  value.length > MAX_DESCRIPTION ? `${value.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : value

export const frontMatterDescription = (text: string, clip = true): string | null => {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]
  if (fm === undefined) return null
  const lines = fm.split(/\r?\n/)
  const i = lines.findIndex((l) => l.startsWith("description:"))
  if (i === -1) return null
  let value = lines[i]!.replace(/^description:\s*/, "")
  if (value === "" || /^[>|][-+]?$/.test(value)) {
    const block: Array<string> = []
    for (const l of lines.slice(i + 1)) {
      if (!/^\s+\S/.test(l)) break
      block.push(l.trim())
    }
    value = block.join(" ")
  }
  value = value.replace(/^["']|["']$/g, "").trim()
  if (value === "") return null
  return clip ? clipDescription(value) : value
}
