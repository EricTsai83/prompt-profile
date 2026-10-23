import type { PromptRecord } from "../domain/PromptRecord.ts"
import { increment, type Counts } from "./counts.ts"

export const MIN_LENGTH = 3
export const MAX_LENGTH = 4000

/** Pure acknowledgements / "go on" replies (compared case-insensitively, punctuation stripped). */
export const ACKNOWLEDGEMENTS: ReadonlyArray<string> = [
  "continue",
  "go",
  "go on",
  "go ahead",
  "yes",
  "yep",
  "yeah",
  "ok",
  "okay",
  "sure",
  "next",
  "proceed",
  "do it",
  "lgtm",
  "thanks",
  "thank you",
  "繼續",
  "好",
  "好的",
  "可以",
  "對",
  "是",
  "嗯",
  "沒問題",
  "繼續吧",
  "好啊",
  "謝謝",
  "感謝",
  "继续",
]

const ACK_SET = new Set(ACKNOWLEDGEMENTS)

const stripPunctuation = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim()

export interface CleanRule {
  readonly name: string
  readonly test: (text: string, previousInSession: string | undefined) => boolean
}

/** Exclusion rules (ordered). Excluded prompts count in `totalPrompts`, not `analyzedPrompts`. */
export const CLEAN_RULES: ReadonlyArray<CleanRule> = [
  { name: "too-short", test: (t) => Array.from(t.trim()).length < MIN_LENGTH },
  { name: "acknowledgement", test: (t) => ACK_SET.has(stripPunctuation(t)) },
  {
    name: "consecutive-duplicate",
    test: (t, prev) => prev !== undefined && prev.trim() === t.trim(),
  },
]

// ---------------------------------------------------------------------------------------
// Pasted code / log detection

const CJK = /[㐀-鿿豈-﫿぀-ヿ가-힯]/g

/** Heuristics for a single line that looks like code, a log line or a stack frame. */
const CODE_LINE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*at\s+\S.*[(:]\S*:\d+(:\d+)?\)?\s*$/, // JS stack frame
  /^\s*File ".*", line \d+/, // Python traceback
  /^\s*\d+\s*[|:]\s/, // numbered source line
  /^\s*\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, // timestamped log
  /^\s*\[?(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL)\]?[\s:]/,
  /^\s*[{}[\]](,)?\s*$/, // lone brackets
  /^\s*"[^"]+"\s*:\s*/, // JSON key
  /[;{}]\s*$/, // ends like a statement / block
  /^\s*(import|export|const|let|var|function|class|def|return|if|for|while|public|private|package|#include|using)\b.*[=({;:]/,
  /^\s*(\/\/|#!|\/\*|\*\s)/, // comments
  /^\s{4,}\S/, // indented by 4+ spaces
  /^\t+\S/, // tab-indented
  /^\s*[<][\w/!][^>]*>\s*$/, // markup line
  /^\s*[$>]\s+\S+/, // shell prompt
  /^\s*(error|Error|TypeError|ReferenceError|SyntaxError|Exception|Traceback)\b/,
]

export const looksLikeCode = (line: string): boolean => {
  if (line.trim() === "") return false
  // Mostly-CJK lines are prose, not code.
  const cjk = line.match(CJK)?.length ?? 0
  if (cjk >= 4 && cjk / line.trim().length > 0.3) return false
  return CODE_LINE_PATTERNS.some((p) => p.test(line))
}

/** A run of at least this many code-like lines (blank lines allowed inside) is collapsed. */
export const MIN_CODE_RUN = 3

export const codePlaceholder = (lines: number): string => `[貼上的程式碼 ${lines} 行]`

/**
 * Replace fenced code blocks and runs of code-like lines with a placeholder. Returns the
 * new text and how many blocks were collapsed.
 */
export const collapseCode = (text: string): { text: string; blocks: number } => {
  let blocks = 0
  // 1. fenced blocks (an unterminated fence runs to the end)
  const fenced = text.replace(/```[^\n]*\n([\s\S]*?)(?:```|$)/g, (_m, body: string) => {
    blocks++
    const n = body.replace(/\n$/, "").split("\n").length
    return codePlaceholder(n)
  })
  // 2. unfenced runs
  const lines = fenced.split("\n")
  const out: Array<string> = []
  let i = 0
  while (i < lines.length) {
    if (!looksLikeCode(lines[i]!)) {
      out.push(lines[i]!)
      i++
      continue
    }
    let j = i
    let codeLines = 0
    let lastCode = i
    while (j < lines.length && (looksLikeCode(lines[j]!) || lines[j]!.trim() === "")) {
      if (lines[j]!.trim() !== "") {
        codeLines++
        lastCode = j
      }
      j++
    }
    if (codeLines >= MIN_CODE_RUN) {
      blocks++
      out.push(codePlaceholder(lastCode - i + 1))
      i = lastCode + 1
    } else {
      out.push(lines[i]!)
      i++
    }
  }
  return { text: out.join("\n"), blocks }
}

/** Keep the beginning and end of overly long text. Lengths are in code points. */
export const truncateMiddle = (
  text: string,
  max = MAX_LENGTH,
): { text: string; truncated: boolean } => {
  const chars = Array.from(text)
  if (chars.length <= max) return { text, truncated: false }
  const keep = max - 40
  const head = Math.ceil(keep * 0.6)
  const tail = keep - head
  const omitted = chars.length - head - tail
  return {
    text: `${chars.slice(0, head).join("")}\n[…省略 ${omitted} 字…]\n${chars.slice(chars.length - tail).join("")}`,
    truncated: true,
  }
}

export interface CleanedPrompt {
  readonly record: PromptRecord
  /** Cleaned text: code collapsed, not yet redacted, not truncated (see `truncateMiddle`). */
  readonly text: string
}

export interface CleanResult {
  readonly prompts: ReadonlyArray<CleanedPrompt>
  readonly excluded: Counts
  readonly codeBlocksCollapsed: number
}

/** Input must be sorted by time (see filter.ts) for the consecutive-duplicate rule. */
export const cleanRecords = (records: ReadonlyArray<PromptRecord>): CleanResult => {
  const excluded: Counts = {}
  const previous = new Map<string, string>()
  const prompts: Array<CleanedPrompt> = []
  let codeBlocksCollapsed = 0
  for (const record of records) {
    const sessionKey = `${record.source}:${record.sessionId}`
    const prev = previous.get(sessionKey)
    previous.set(sessionKey, record.text)
    const rule = CLEAN_RULES.find((r) => r.test(record.text, prev))
    if (rule && !(rule.name === "too-short" && record.hasImage)) {
      increment(excluded, rule.name)
      continue
    }
    const collapsed = collapseCode(record.text.trim())
    codeBlocksCollapsed += collapsed.blocks
    prompts.push({ record, text: collapsed.text })
  }
  return { prompts, excluded, codeBlocksCollapsed }
}
