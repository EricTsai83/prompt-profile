import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { readFileSync } from "node:fs"
import {
  decodeProfile,
  encodeProfile,
  MAX_QUOTE_LENGTH,
  type Profile,
} from "../../src/domain/Profile.ts"
import { checkOutput, PERSONAL_RULES, SECRET_RULES } from "../../src/pipeline/audit.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))

// Fake values with the real shapes (never real data).
const TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
const EMAIL = "someone@example.com"

const leaky = (p: Profile): Profile => ({
  ...p,
  funFacts: [`Pasted ${TOKEN} once`, ...p.funFacts.slice(1)],
  traits: p.traits.map((t, i) =>
    i === 1 ? { ...t, description: `Mails ${EMAIL} from /Users/alice/work` } : t,
  ),
  translations: {
    "zh-TW": {
      ...p.translations["zh-TW"]!,
      headline: `寄信給 ${EMAIL}`,
    },
  },
})

const check = (p: Profile, mode: "mask" | "warn" | "strict", allow: Array<string> = []) =>
  checkOutput(p, { mode, allow, username: "alice" })

describe("final output check", () => {
  it.effect("finds nothing in a clean profile and leaves it unchanged", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const r = check(p, "strict")
      expect(r.findings).toEqual([])
      expect(r.blocked).toBe(false)
      expect(r.profile).toEqual(p)
    }),
  )

  it.effect("episodes: generated text and quotes are checked, session ids are codes", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const [first, ...rest] = p.episodes
      const session = "codex:0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"
      const withEpisode: Profile = {
        ...p,
        episodes: [
          {
            ...first!,
            session,
            task: `Emailing ${EMAIL}`,
            turns: [{ ...first!.turns[0]!, quote: `token ${TOKEN}` }, ...first!.turns.slice(1)],
          },
          ...rest,
        ],
      }
      const r = check(withEpisode, "mask")
      expect(r.findings.map((f) => [f.location, f.rule])).toEqual([
        ["Episodes › 1", "email"],
        ["Episodes › 1", "api-token"],
      ])
      expect(r.profile.episodes[0]!.session).toBe(session)
      expect(r.profile.episodes[0]!.task).not.toContain(EMAIL)
    }),
  )

  it.effect("usage model ids are codes: a fine-tuned id is neither masked nor reported", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const id = "ft:gpt-4o:org-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
      const [claude, codex] = p.usage!.sources
      const withId: Profile = {
        ...p,
        usage: {
          ...p.usage!,
          sources: [
            claude!,
            {
              ...codex!,
              byModel: [{ ...codex!.byModel[0]!, model: id }, ...codex!.byModel.slice(1)],
              unpricedModels: [id],
            },
          ],
        },
      }
      const r = check(withId, "strict")
      expect(r.findings).toEqual([])
      expect(r.profile.usage!.sources[1]!.byModel[0]!.model).toBe(id)
      expect(r.profile.usage!.sources[1]!.unpricedModels).toEqual([id])
    }),
  )

  it.effect("mask: masks secrets and personal data, and says where", () =>
    Effect.gen(function* () {
      const r = check(leaky(yield* sample()), "mask")
      expect(r.blocked).toBe(false)
      expect(r.profile.funFacts[0]).toBe("Pasted [SECRET] once")
      expect(r.profile.traits[1]!.description).toBe("Mails [EMAIL] from ~/work")
      expect(r.profile.translations["zh-TW"]!.headline).toBe("寄信給 [EMAIL]")
      expect(r.findings).toEqual([
        { location: "Headline (zh-TW)", rule: "email", tier: "personal", count: 1, masked: true },
        { location: "Traits › 2", rule: "email", tier: "personal", count: 1, masked: true },
        { location: "Traits › 2", rule: "home-path", tier: "personal", count: 1, masked: true },
        { location: "Fun facts › 1", rule: "api-token", tier: "secret", count: 1, masked: true },
      ])
    }),
  )

  it.effect("warn keeps personal data but still masks secrets", () =>
    Effect.gen(function* () {
      const r = check(leaky(yield* sample()), "warn")
      expect(r.blocked).toBe(false)
      expect(r.profile.funFacts[0]).toBe("Pasted [SECRET] once")
      expect(r.profile.traits[1]!.description).toBe(`Mails ${EMAIL} from /Users/alice/work`)
      expect(r.findings.filter((f) => f.tier === "personal").every((f) => !f.masked)).toBe(true)
      expect(r.findings.find((f) => f.tier === "secret")!.masked).toBe(true)
    }),
  )

  it.effect("strict blocks on any finding", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      expect(check(leaky(p), "strict").blocked).toBe(true)
      const onlySecret = { ...p, funFacts: [`Pasted ${TOKEN}`] }
      expect(check(onlySecret, "strict").blocked).toBe(true)
    }),
  )

  it.effect("allow releases a personal rule, never a secret one", () =>
    Effect.gen(function* () {
      const r = check(leaky(yield* sample()), "strict", [
        "email",
        "home-path",
        "username",
        "api-token",
      ])
      expect(r.profile.traits[1]!.description).toBe(`Mails ${EMAIL} from /Users/alice/work`)
      expect(r.findings.map((f) => f.rule)).toEqual(["api-token"])
      expect(r.blocked).toBe(true)
    }),
  )

  it.effect("never touches machine fields", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const withIds: Profile = {
        ...p,
        traits: p.traits.map((t) => ({
          ...t,
          evidence: t.evidence.map((e) => ({ ...e, promptId: "0123456789abcdef0123456789abcdef" })),
        })),
      }
      const r = check(withIds, "strict")
      expect(r.findings).toEqual([])
      expect(DateTime.isDateTime(r.profile.generatedAt)).toBe(true)
    }),
  )

  it("splits the redaction rules into two tiers, without overlap", () => {
    expect(SECRET_RULES).toContain("api-token")
    expect(PERSONAL_RULES).toContain("email")
    expect(SECRET_RULES.some((r) => (PERSONAL_RULES as ReadonlyArray<string>).includes(r))).toBe(
      false,
    )
  })

  it.effect("a masked quote still fits the quote length limit, marker intact", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const quote = `${"x".repeat(MAX_QUOTE_LENGTH - 7)} a@b.co`
      expect(quote.length).toBe(MAX_QUOTE_LENGTH)
      const long: Profile = {
        ...p,
        traits: p.traits.map((t, i) =>
          i === 0 ? { ...t, evidence: [{ ...t.evidence[0]!, quote }] } : t,
        ),
      }
      const out = check(long, "mask").profile.traits[0]!.evidence[0]!.quote
      expect(out.length).toBeLessThanOrEqual(MAX_QUOTE_LENGTH)
      expect(out.endsWith("…")).toBe(true)
      expect(out).not.toContain("a@b.co")
      expect(out).not.toMatch(/\[[A-Z_]*…$/)
      expect(encodeProfile(check(long, "mask").profile)).toBeDefined()
    }),
  )

  it.effect("model ids are not checked, even when they contain the username", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const t = p.stats.techniques!
      const withModel: Profile = {
        ...p,
        engine: { ...p.engine, model: "alice-code" },
        stats: {
          ...p.stats,
          techniques: {
            ...t,
            details: { ...t.details, models: [{ ...t.details.models[0]!, name: "alice-code" }] },
          },
        },
      }
      const r = check(withModel, "strict")
      expect(r.findings).toEqual([])
      expect(r.profile.engine.model).toBe("alice-code")
    }),
  )
})

it.effect(
  "preserves only a valid context identity, while auditing prose and malformed identities",
  () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const identity = "c4c884978a31db79e95a7a7d0611873a651e6c21cd2a878bb85f44bd3939a402"
      const context = { identity, selected: 1, excluded: 0, missing: 0 }
      const result = check({ ...p, context, headline: identity }, "mask")
      expect(result.profile.context?.identity).toBe(identity)
      expect(result.profile.headline).toBe("[SECRET]")
      expect(
        check({ ...p, context: { ...context, identity: EMAIL } }, "mask").profile.context?.identity,
      ).toBe("[EMAIL]")
    }),
)

it.effect("treats a validated narration voice as a code rather than an OS username", () =>
  Effect.gen(function* () {
    const p = yield* sample()
    const result = checkOutput(
      { ...p, voice: "first" },
      { mode: "mask", allow: [], username: "first" },
    )
    expect(result.profile.voice).toBe("first")
  }),
)
