/** A named exclusion rule. Rules are data so diagnostics can report counts per name. */
export interface ExcludeRule<T> {
  readonly name: string
  readonly test: (input: T) => boolean
}

export const firstMatch = <T>(
  rules: ReadonlyArray<ExcludeRule<T>>,
  input: T,
): ExcludeRule<T> | undefined => rules.find((r) => r.test(input))

/** Extract the slash command name from `<command-name>/foo</command-name>` or `/foo args`. */
export const slashCommandName = (text: string): string | null => {
  const tagged = /<command-name>\s*(\/?[\w:.-]+)\s*<\/command-name>/.exec(text)
  if (tagged) return tagged[1]!.startsWith("/") ? tagged[1]! : `/${tagged[1]}`
  // `/clear`, `/model opus` — but not a path like `/Users/me/file`
  const plain = /^\/([A-Za-z][\w:.-]*)(?=\s|$)/.exec(text.trim())
  return plain ? `/${plain[1]}` : null
}
