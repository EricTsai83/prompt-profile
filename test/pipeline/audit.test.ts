import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
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
})
