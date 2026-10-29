/**
 * Render every successful case with the production renderer (plan 22 §4). Rendering never
 * calls an LLM; `--from` uses the same path to rebuild from saved artifacts.
 */
import { Effect, FileSystem, Path } from "effect"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { writeReport, type CjkFonts } from "../../src/report/index.ts"
import { LOOK_IDS, RENDER_MANIFEST_VERSION, type LookId } from "../../src/report/looks.ts"
import { lookOf } from "../../src/report/theme.ts"
import { MANIFEST_VERSION, type Manifest, type RenderRecord } from "./execute.ts"
import { caseDir } from "./prepare.ts"

export type Loaded =
  | { readonly ok: true; readonly profile: Profile }
  | { readonly ok: false; readonly error: string }

/** Decode each ok case's saved profile (older versions migrate); a bad one is reported, not fatal. */
export const loadProfiles = (root: string, manifest: Manifest) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const out = new Map<string, Loaded>()
    for (const c of manifest.cases) {
      if (c.status !== "ok") continue
      const loaded = yield* fs.readFileString(path.join(root, c.dir, "profile.json")).pipe(
        Effect.flatMap((text) =>
          Effect.try({ try: () => JSON.parse(text) as unknown, catch: () => "not valid JSON" }),
        ),
        Effect.flatMap((json) =>
          decodeProfile(json).pipe(
            Effect.mapError((e) =>
              e._tag === "UnsupportedProfileVersion"
                ? `incompatible profile schemaVersion ${JSON.stringify(e.found)} (supported ${e.supported})`
                : "invalid profile",
            ),
          ),
        ),
        Effect.map((profile): Loaded => ({ ok: true, profile })),
        Effect.catch((e) =>
          Effect.succeed<Loaded>({
            ok: false,
            error: typeof e === "string" ? e : "unreadable profile",
          }),
        ),
      )
      out.set(c.id, loaded)
    }
    return out
  })

/** One complete report and a card per profile language, per case and look. */
export const renderCases = (
  root: string,
  manifest: Manifest,
  profiles: ReadonlyMap<string, Loaded>,
  looks: ReadonlyArray<LookId>,
  cjkFonts: CjkFonts,
  now: () => Date = () => new Date(),
) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const records: Array<RenderRecord> = []
    for (const c of manifest.cases) {
      const loaded = profiles.get(c.id)
      if (loaded === undefined) continue
      for (const look of looks) {
        const dir = `${c.dir}/render/${look}`
        const base = {
          case: c.id,
          look,
          lookVersion: lookOf(look).version,
          renderManifestVersion: RENDER_MANIFEST_VERSION,
          renderedAt: now().toISOString(),
        }
        if (!loaded.ok) {
          records.push({ ...base, html: null, cards: [], error: loaded.error })
          continue
        }
        const record = yield* writeReport(
          loaded.profile,
          path.join(root, dir),
          { look, cardHide: [], exclude: [] },
          "../../profile.json",
          cjkFonts,
        ).pipe(
          Effect.map((files): RenderRecord => ({
            ...base,
            html: `${dir}/report.html`,
            cards: files.cards.map((card) => ({
              language: card.language,
              file: card.file === null ? null : `${dir}/${path.basename(card.file)}`,
              error: card.error,
            })),
            error: null,
          })),
          Effect.catch((e: Error) =>
            Effect.succeed<RenderRecord>({ ...base, html: null, cards: [], error: e.message }),
          ),
        )
        records.push(record)
      }
    }
    return records
  })

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/

/**
 * Check a saved manifest before `--from` reads or writes anything with it: it is a file on
 * disk and may have been edited. Every path is rebuilt from validated ids, so nothing can
 * point outside the experiment folder.
 */
export const manifestProblems = (m: unknown): ReadonlyArray<string> => {
  const problems: Array<string> = []
  const o = m as Partial<Manifest> | null
  if (typeof o !== "object" || o === null) return ["manifest is not a JSON object"]
  if (o.manifestVersion !== MANIFEST_VERSION)
    return [
      `Unsupported experiment manifest version ${JSON.stringify(o.manifestVersion)} (supported ${MANIFEST_VERSION})`,
    ]
  const looks = o.config?.looks
  if (!Array.isArray(looks) || looks.length === 0) problems.push("manifest config has no looks")
  else
    for (const look of looks)
      if (!LOOK_IDS.includes(look as LookId))
        problems.push(`manifest has an unknown look ${JSON.stringify(look)}`)
  if (!Array.isArray(o.cases)) return [...problems, "manifest has no case list"]
  for (const [i, c] of o.cases.entries()) {
    const ok =
      typeof c === "object" &&
      c !== null &&
      typeof c.persona === "string" &&
      SAFE_ID.test(c.persona) &&
      typeof c.variant === "string" &&
      SAFE_ID.test(c.variant) &&
      Number.isSafeInteger(c.repeat) &&
      c.repeat >= 1 &&
      c.dir === caseDir({ persona: c.persona, repeat: c.repeat, variant: { id: c.variant } }) &&
      c.id === `${c.persona}/${c.variant}/r${c.repeat}`
    if (!ok) problems.push(`manifest case ${i} has an invalid persona, variant, repeat or folder`)
  }
  return problems
}

/** Read a saved experiment manifest for `--from`; refuses formats it does not understand. */
export const readManifest = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const text = yield* fs.readFileString(path.join(root, "manifest.json"))
    const manifest = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () => new Error("manifest.json is not valid JSON"),
    })
    const problems = manifestProblems(manifest)
    if (problems.length > 0) return yield* Effect.fail(new Error(problems.join("; ")))
    return manifest as Manifest
  })
