// Builds blind review packets from runs/: one Markdown file per persona with every successful
// profile under a letter, in a seeded shuffled order, and key.json mapping letters to runs.
// Reviewers read blind/*.md only; key.json is opened after the review.
//   node docs/ux/model-comparison/make-blind.mjs
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const runs = path.join(here, "runs")
const out = path.join(here, "blind")
mkdirSync(out, { recursive: true })

const rank = (seed, id) => createHash("sha256").update(`${seed}:${id}`).digest("hex")
const key = {}

for (const persona of readdirSync(path.join(runs, "claude")).toSorted()) {
  const entries = []
  for (const engine of readdirSync(runs).filter((e) => !e.endsWith(".json"))) {
    const dir = path.join(runs, engine, persona)
    if (!existsSync(dir)) continue
    for (const repeat of readdirSync(dir).toSorted()) {
      const file = path.join(dir, repeat, "profile.json")
      if (existsSync(file)) entries.push({ engine, repeat, file })
    }
  }
  entries.sort((a, b) =>
    rank(persona, `${a.engine}/${a.repeat}`).localeCompare(
      rank(persona, `${b.engine}/${b.repeat}`),
    ),
  )
  const sections = entries.map((entry, i) => {
    const letter = String.fromCharCode(65 + i)
    key[`${persona}/${letter}`] = { engine: entry.engine, repeat: entry.repeat }
    const p = JSON.parse(readFileSync(entry.file, "utf8"))
    const evidence = (xs) =>
      xs.length === 0 ? "  - (no verified evidence)" : xs.map((e) => `  - "${e.quote}"`).join("\n")
    return [
      `## Profile ${letter}`,
      "",
      `**Headline:** ${p.headline}`,
      "",
      `**Archetype:** ${p.archetype.name}: ${p.archetype.description}`,
      "",
      "### Traits",
      ...p.traits.map(
        (t) => `- **${t.name}** (${t.confidence}): ${t.description}\n${evidence(t.evidence)}`,
      ),
      "",
      "### Dimensions",
      ...p.dimensions.map((d) => `- **${d.title}**: ${d.summary}\n${evidence(d.evidence)}`),
      "",
      "### Fun facts",
      ...p.funFacts.map((f) => `- ${f}`),
      "",
      `Coverage: ${p.coverage.evidenceKept} quotes kept, ${p.coverage.evidenceDropped} dropped.`,
      "",
    ].join("\n")
  })
  writeFileSync(
    path.join(out, `${persona}.md`),
    [
      `# Blind review: ${persona}`,
      "",
      "Synthetic persona. Engine and model labels are removed; the order is shuffled.",
      "",
      ...sections,
    ].join("\n"),
  )
}
writeFileSync(path.join(here, "key.json"), `${JSON.stringify(key, null, 2)}\n`)
console.log(`${Object.keys(key).length} profiles in ${readdirSync(out).length} packets`)
