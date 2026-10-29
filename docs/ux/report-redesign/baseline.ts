/** Fictional baseline only; no history or LLM access. Run with pnpm exec tsx. */
import { readFileSync, writeFileSync } from "node:fs"
import { Effect } from "effect"
import { decodeProfile } from "../../../src/domain/Profile.ts"
import { renderHtml } from "../../../src/report/html.ts"

const profile = await Effect.runPromise(
  decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
)
const portrait = JSON.parse(readFileSync("test/fixtures/portrait.sample.json", "utf8"))
// The fixture predates translated portraits. Keep that limitation visible in the critique.
writeFileSync("docs/ux/report-redesign/current.html", renderHtml({ ...profile, portrait }))
