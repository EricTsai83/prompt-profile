/**
 * `pnpm inspect:openings [--min 3] [--chars 160]`: for the owner's eyes only.
 * Prints the opening text of session first prompts that several sessions share (the groups the
 * smoke test lists only as hashes), so the owner can decide whether they are AI-delegated
 * subtasks. Only the keys go into DELEGATION_OPENINGS (src/pipeline/filter.ts), never the text.
 *
 * It prints real prompt text: run it in your own terminal, not through an AI assistant, and do
 * not paste its output anywhere. It reads local files only and writes nothing.
 */
import { NodeServices } from "@effect/platform-node"
import { DateTime, Effect } from "effect"
import { homedir } from "node:os"
import { parseArgs } from "node:util"
import { makeAdapters, readSources } from "../src/adapters/registry.ts"
import { openingKey } from "../src/pipeline/filter.ts"

const { values } = parseArgs({
  options: {
    min: { type: "string", default: "3" },
    chars: { type: "string", default: "160" },
  },
})
const min = Number(values.min)
const chars = Number(values.chars)

const program = Effect.gen(function* () {
  const adapters = yield* makeAdapters({ home: homedir(), env: process.env })
  const records = (yield* readSources(adapters)).flatMap((s) => s.records)
  const first = new Map<string, (typeof records)[number]>()
  for (const r of records.toSorted(
    (a, b) => DateTime.toEpochMillis(a.timestamp) - DateTime.toEpochMillis(b.timestamp),
  )) {
    const key = `${r.source}:${r.sessionId}`
    if (!first.has(key)) first.set(key, r)
  }
  // Same keys as test/smoke/pipeline.test.ts and DELEGATION_OPENINGS.
  const groups = new Map<string, Array<(typeof records)[number]>>()
  for (const r of first.values()) {
    const k = openingKey(r)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const repeated = [...groups.entries()]
    .filter(([, rs]) => rs.length >= min)
    .toSorted((a, b) => b[1].length - a[1].length)
  for (const [k, rs] of repeated) {
    const sample = rs[0]!
    console.log(
      `\n=== ${k} · ${rs.length} sessions · first ${DateTime.formatIso(sample.timestamp)}`,
    )
    console.log(Array.from(sample.text).slice(0, chars).join("").replace(/\s+/g, " "))
  }
  console.log(
    `\n${repeated.length} groups. For each one that is an automated subtask (not typed by you),` +
      " give your assistant only its key (e.g. `sdk-ts c37ddb64`) for DELEGATION_OPENINGS.",
  )
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
