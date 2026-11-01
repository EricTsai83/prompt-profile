import { frontMatterDescription } from "./skills.ts"
import type { InstructionContext } from "../../domain/index.ts"

const base = (path: string) => path.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? path
const skillName = (path: string) => /\/([^/]+)\/SKILL\.md$/i.exec(path)?.[1]
const kindOf = (path: string): InstructionContext["kind"] =>
  /SKILL\.md$/i.test(path) ? "skill" : /(?:CLAUDE|AGENTS?)\.md$/i.test(path) ? "rules" : "reference"
const recognized = (path: string) => /^(?:SKILL|CLAUDE|AGENTS?)\.md$/i.test(base(path))
const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content
          .map((x) => (x && typeof x === "object" && typeof x.text === "string" ? x.text : ""))
          .filter(Boolean)
          .join("\n")
      : ""

const userText = (content: unknown): string =>
  textOf(
    Array.isArray(content)
      ? content.filter(
          (x) => x && x.type !== "input_file" && x.type !== "file" && x.type !== "tool_result",
        )
      : content,
  )

const SHELL_VARIABLES = new Set([
  "HOME",
  "PWD",
  "PATH",
  "TMPDIR",
  "CODEX_HOME",
  "CLAUDE_CONFIG_DIR",
  "USER",
  "SHELL",
])
const NON_ADOPTION = [/should I|whether to|do we need/i, /這句話|不適合|是不是|要不要/]
const NON_USER_PREFIXES = [
  "Delegated task node:",
  "[Assistant quote]",
  "Context handoff",
  "[Historical assistant;",
]
const readOutput = (output: unknown): { text: string; failed: boolean } => {
  if (Array.isArray(output)) {
    const wrapped: Array<{ output: string; exit_code: number }> = []
    for (const block of output) {
      if (typeof block?.text !== "string") continue
      try {
        const value = JSON.parse(block.text)
        if (typeof value?.output === "string" && typeof value.exit_code === "number")
          wrapped.push(value)
      } catch {
        /* A plain text block is not a structured command result. */
      }
    }
    if (wrapped.length === 1)
      return { text: wrapped[0]!.output, failed: wrapped[0]!.exit_code !== 0 }
    if (wrapped.length > 1) return { text: "", failed: true }
  }
  const text = textOf(output)
  return { text, failed: /Process exited with code [1-9]\d*/.test(text) }
}

/** Per-transcript bounded tracking. No filesystem lookup or authorship inference from paths. */
export class InstructionTracker {
  private batches = new Map<string, number>()
  private descriptions = new Map<string, string>()
  private observed = new Set<string>()
  private current: string | null = null
  private prompts = new Map<string, string>()
  private contexts = new Map<string, Array<InstructionContext>>()
  private calls = new Map<string, { parent: string; index: number }>()
  private pendingAutomatic: Array<{ path: string; body: string | null }> = []
  rejected = 0

  describe(name: string, description: string) {
    if (!name || !description || description.length > 100_000) {
      this.rejected++
      return
    }
    this.descriptions.set(name, description)
    if (this.current !== null) {
      const list = this.contexts.get(this.current) ?? []
      for (let i = 0; i < list.length; i++) {
        if (list[i]!.name === name && !list[i]!.description) list[i] = { ...list[i]!, description }
      }
    }
  }

  user(id: string, text: string) {
    if (NON_USER_PREFIXES.some((prefix) => text.trimStart().startsWith(prefix))) {
      this.current = null
      return
    }
    this.current = id
    this.prompts.set(id, text)
    if (!this.contexts.has(id)) this.contexts.set(id, [])
    for (const p of this.pendingAutomatic.splice(0)) this.add(p.path, "automatic", p.body)
    const negated = /do not use|don't use|不要使用|不要用/i.test(text)
    if (negated) return
    const names = [
      ...[
        ...text.matchAll(
          /\$([\w.:-]+)|<command-name>\/([\w.:-]+)<\/command-name>|^\/([\w.:-]+)(?:\s|$)/gm,
        ),
      ].map((m) => m[1] ?? m[2] ?? m[3]!),
      ...[
        ...text.matchAll(
          /(?:use|read|attach|follow|apply|讀取|使用|套用|附加|依照)\s+\[[^\]]+\]\(([^)\s]+\.md)\)/gi,
        ),
      ].map((m) => m[1]!),
      ...[
        ...text.matchAll(
          /(?:use|read|attach|follow|apply|讀取|使用|套用|附加|依照)\s+([^\s[\]()"'<>]+\.md)\b/gi,
        ),
      ].map((m) => m[1]!),
    ].filter((name) => !name.includes("://") && !name.includes("?") && !SHELL_VARIABLES.has(name))
    for (const name of names.slice(0, 6))
      this.add(
        name.replace(/[.:-]+$/, ""),
        NON_ADOPTION.some((pattern) => pattern.test(text)) ? "unknown" : "user_explicit",
        null,
      )
  }

  private add(path: string, selection: InstructionContext["selection"], body: string | null) {
    if (this.current === null) return
    const list = this.contexts.get(this.current)!
    const name = skillName(path) ?? base(path)
    let index = list.findIndex((c) => c.name === name || c.name === path)
    if (index < 0) {
      if (list.length >= 6) {
        this.rejected++
        return
      }
      const prompt = this.prompts.get(this.current)!
      index = list.length
      list.push({
        id: `${this.current}:instruction:${index}`,
        parentPromptId: this.current,
        name,
        kind: /\.md$/i.test(path) ? kindOf(path) : "skill",
        selection,
        selectionEvidence: selection === "user_explicit" ? prompt : null,
        description: this.descriptions.get(name) ?? null,
        content: null,
        contentStatus: "missing",
      })
    }
    if (body !== null && list[index]!.content === null) {
      this.observed.add(this.current)
      const c = list[index]!
      // Never slice raw text through a secret. Oversized bodies remain unavailable;
      // accepted bodies are redacted before the pipeline truncates them.
      if (body.length > 100_000) {
        this.rejected++
        return index
      }
      list[index] = {
        ...c,
        description: frontMatterDescription(body, false) ?? c.description ?? null,
        content: body,
        contentStatus: "recorded",
      }
    }
    return index
  }

  read(callId: string, path: string) {
    if (typeof callId !== "string" || typeof path !== "string") {
      this.rejected++
      return
    }
    if (this.current === null) return
    if (
      !recognized(path) &&
      !this.forPrompt(this.current).some(
        (c) => c.name === base(path) && c.selection === "user_explicit",
      )
    )
      return
    this.observed.add(this.current)
    const index = this.add(path, "agent_selected", null)
    if (index !== undefined) this.calls.set(callId, { parent: this.current, index })
  }
  result(callId: string, body: string, failed = false) {
    const ref = this.calls.get(callId)
    if (!ref) return
    if (failed) {
      this.calls.delete(callId)
      return
    }
    if (!body.trim() || /^Launching skill:/i.test(body)) return
    const list = this.contexts.get(ref.parent)!
    const c = list[ref.index]!
    if (c.content !== null) {
      this.calls.delete(callId)
      return
    }
    if (body.length > 100_000) {
      this.rejected++
      this.calls.delete(callId)
      return
    }
    list[ref.index] = {
      ...c,
      description: frontMatterDescription(body, false) ?? c.description ?? null,
      content: body,
      contentStatus: "recorded",
    }
    this.calls.delete(callId)
  }
  automatic(path: string, body: string) {
    if (this.current === null) {
      if (body.length > 100_000) this.rejected++
      if (this.pendingAutomatic.length < 6)
        this.pendingAutomatic.push({ path, body: body.length > 100_000 ? null : body })
    } else this.add(path, "automatic", body)
  }
  hasObserved(id: string) {
    return this.observed.has(id)
  }
  forPrompt(id: string): ReadonlyArray<InstructionContext> {
    return this.contexts.get(id) ?? []
  }

  private attachments(content: unknown) {
    if (!Array.isArray(content)) return
    for (const item of content) {
      if (
        (item?.type === "input_file" || item?.type === "file") &&
        typeof item.filename === "string"
      )
        this.add(item.filename, "user_explicit", typeof item.text === "string" ? item.text : null)
    }
  }

  /** Read only structured messages, exact file reads and their matching results. */
  claude(raw: unknown) {
    const x = raw as Record<string, any>
    if (!x || x.isSidechain === true || typeof x.sessionId !== "string") return
    if (
      x.type === "attachment" &&
      x.attachment?.type === "skill_listing" &&
      typeof x.attachment.content === "string"
    ) {
      for (const match of x.attachment.content.matchAll(/^- ([\w.:@/-]{1,80}):\s*(\S.*)$/gm))
        this.describe(match[1]!, match[2]!)
    }
    const items = x.message?.content
    const expanded =
      x.isMeta === true
        ? /^Base directory for this skill: ([^\n]+)\n+([\s\S]*)$/.exec(textOf(items))
        : null
    if (expanded) {
      this.add(`${expanded[1]!.trim()}/SKILL.md`, "automatic", expanded[2]!)
      return
    }
    if (x.type === "user" && typeof x.uuid === "string" && !x.isMeta) {
      const text = userText(items)
      if (text) {
        this.user(`claude-code:${x.sessionId}:${x.uuid}`, text)
        this.attachments(items)
      }
    }
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (
        item?.type === "tool_use" &&
        item.name === "Skill" &&
        typeof item.input?.skill === "string"
      )
        this.read(item.id, `/skills/${item.input.skill}/SKILL.md`)
      if (
        item?.type === "tool_use" &&
        item.name === "Read" &&
        typeof item.input?.file_path === "string"
      )
        this.read(item.id, item.input.file_path)
      if (item?.type === "tool_result" && typeof item.tool_use_id === "string")
        this.result(item.tool_use_id, textOf(item.content), item.is_error === true)
    }
  }

  codex(raw: unknown, id: string) {
    const x = raw as Record<string, any>
    const p = x?.payload
    if (x?.type !== "response_item" || !p) return
    if (p.type === "message" && p.role === "user") {
      const text = userText(p.content)
      if (text.startsWith("# AGENTS.md instructions") || text.startsWith("<user_instructions>"))
        this.automatic("AGENTS.md", text)
      else if (text && !text.startsWith("<environment_context>")) {
        this.user(id, text)
        this.attachments(p.content)
      }
    }
    if (p.type === "function_call" || p.type === "custom_tool_call") {
      let args = p.arguments ?? p.input
      try {
        if (typeof args === "string" && args.startsWith("{")) args = JSON.parse(args)
      } catch {
        this.rejected++
        return
      }
      if (
        args &&
        typeof args === "object" &&
        typeof (args.path ?? args.file_path) === "string" &&
        /read/i.test(p.name ?? "")
      )
        this.read(p.call_id, args.path ?? args.file_path)
      // An exact cat command is a read. Do not infer which file a compound shell command returned.
      let command = typeof args === "object" && args !== null ? (args.command ?? args.cmd) : args
      if (typeof command === "string" && p.name === "exec") {
        const statement =
          /\s*text\(\s*await tools\.exec_command\(\s*\{\s*cmd\s*:\s*("(?:[^"\\]|\\.)*")\s*(?:,\s*["']?max_output_tokens["']?\s*:\s*\d+)?\s*\}\s*\)\s*\)\s*;?\s*/g
        const matches = [...command.matchAll(statement)]
        if (
          matches.length > 0 &&
          matches.length <= 8 &&
          command.replace(statement, "").trim() === ""
        ) {
          let commands: ReadonlyArray<unknown>
          try {
            commands = matches.map((match) => JSON.parse(match[1]!))
          } catch {
            this.rejected++
            return
          }
          this.batches.set(p.call_id, matches.length)
          for (const [index, cmd] of commands.entries()) {
            if (typeof cmd !== "string") continue
            const path = /^cat\s+["']?([^\s"']+\.md)["']?\s*$/.exec(cmd)?.[1]
            if (path) this.read(`${p.call_id}:${index}`, path)
          }
          return
        }
      }
      if (typeof command === "string") {
        const m = /^cat\s+["']?([^\s"']+\.md)["']?\s*$/.exec(command)
        if (m) this.read(p.call_id, m[1]!)
      }
    }
    if (
      (p.type === "function_call_output" || p.type === "custom_tool_call_output") &&
      typeof p.call_id === "string"
    ) {
      const batch = this.batches.get(p.call_id)
      if (batch !== undefined) {
        const outputs: Array<{ output: string; exit_code: number }> = []
        if (Array.isArray(p.output))
          for (const block of p.output) {
            if (typeof block?.text !== "string") continue
            try {
              const value = JSON.parse(block.text)
              if (typeof value?.output === "string" && typeof value.exit_code === "number")
                outputs.push(value)
            } catch {
              /* Non-JSON framing text is not a command result. */
            }
          }
        if (outputs.length === batch) {
          outputs.forEach((output, index) =>
            this.result(`${p.call_id}:${index}`, output.output, output.exit_code !== 0),
          )
        } else this.rejected++
        this.batches.delete(p.call_id)
        return
      }
      const output = readOutput(p.output)
      this.result(p.call_id, output.text, p.is_error === true || output.failed)
    }
  }
}
