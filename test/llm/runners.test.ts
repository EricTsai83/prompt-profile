import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { makeClaudeCodeRunner } from "../../src/llm/claude.ts"
import { makeCodexRunner } from "../../src/llm/codex.ts"
import { classifyFailure, CLASSIFY_RULES, sanitizeStderr } from "../../src/llm/classify.ts"
import { makeFakeLlmRunner, fakeHash } from "../../src/llm/fake.ts"
import { ANALYSIS_MARKER } from "../../src/domain/markers.ts"
import {
  InvalidOutput,
  makeLlmSchema,
  NotLoggedIn,
  RateLimited,
  type LlmError,
} from "../../src/llm/LlmRunner.ts"
import { retryDelay, withRetry } from "../../src/llm/retry.ts"
import {
  chooseRunner,
  detectRunner,
  parseClaudeAuth,
  parseClaudePlan,
  parseCodexLogin,
} from "../../src/llm/detect.ts"
import { makeFakeSpawner, type Respond } from "./fakeSpawner.ts"

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/llm/${name}`, import.meta.url), "utf8")

const OkSchema = makeLlmSchema("Ok", Schema.Struct({ ok: Schema.Boolean }))
const input = { system: "SYSTEM INSTRUCTIONS", prompt: "secret user prompt text", schema: OkSchema }

const withSpawner = (respond: Respond) => {
  const fake = makeFakeSpawner(respond)
  // Our fake spawner overrides NodeServices' real one.
  const layer = Layer.merge(NodeServices.layer, fake.layer)
  return { ...fake, layer }
}

describe("ClaudeCodeRunner", () => {
  it.effect("sends the expected args, prompt on stdin, and parses structured_output", () => {
    const fake = withSpawner(() => ({ exitCode: 0, stdout: fixture("claude-output.success.json") }))
    return Effect.gen(function* () {
      const runner = yield* makeClaudeCodeRunner({ model: "opus" })
      const result = yield* runner.generate(input)
      expect(result.value).toEqual({ ok: true })
      expect(result.model).toBe("claude-opus-5-5")
      expect(result.modelSource).toBe("reported")
      expect(result.usage).toEqual({ inputTokens: 1175, outputTokens: 52, costUsd: 0.0105593 })
      const rec = fake.records[0]!
      expect(rec.command).toBe("claude")
      expect(rec.args).toContain("--safe-mode")
      expect(rec.stdin).toBe(`${ANALYSIS_MARKER}\nsecret user prompt text`)
      expect(rec.args.join(" ")).not.toContain("secret user prompt")
      expect(
        rec.args.map((a) => (a.startsWith("{") ? "<json>" : a.replace(/\n[\s\S]*/, "…"))),
      ).toMatchSnapshot()
      // per-call temp workdir is removed afterwards
      expect(rec.cwd).toMatch(/prompt-profile-/)
      expect(existsSync(rec.cwd!)).toBe(false)
    }).pipe(Effect.provide(fake.layer))
  })

  it.effect.each([
    [
      "model error → ProcessFailed",
      { exitCode: 1, stdout: fixture("claude-output.model-error.json") },
      "ProcessFailed",
    ],
    [
      "401 → NotLoggedIn",
      {
        exitCode: 1,
        stdout: JSON.stringify({
          is_error: true,
          api_error_status: 401,
          result: "Invalid API key · Please run /login",
        }),
      },
      "NotLoggedIn",
    ],
    [
      "429 → RateLimited",
      {
        exitCode: 1,
        stdout: JSON.stringify({ is_error: true, api_error_status: 429, result: "rate limited" }),
      },
      "RateLimited",
    ],
    ["garbage stdout exit 0 → InvalidOutput", { exitCode: 0, stdout: "not json" }, "InvalidOutput"],
    [
      "schema mismatch → InvalidOutput",
      {
        exitCode: 0,
        stdout: JSON.stringify({ is_error: false, structured_output: { ok: "yes" } }),
      },
      "InvalidOutput",
    ],
    ["crash → ProcessFailed", { exitCode: 2, stdout: "", stderr: "boom" }, "ProcessFailed"],
    ["SIGINT → Interrupted", { exitCode: 130, stdout: "" }, "Interrupted"],
    ["missing binary → NotInstalled", "enoent" as const, "NotInstalled"],
  ] as const)("%s", ([, response, tag]) => {
    const fake = withSpawner(() => response)
    return Effect.gen(function* () {
      const runner = yield* makeClaudeCodeRunner()
      const error = yield* Effect.flip(runner.generate(input))
      expect(error._tag).toBe(tag)
    }).pipe(Effect.provide(fake.layer))
  })

  it.effect("timeout kills the child process and removes the workdir", () => {
    const fake = withSpawner(() => "hang")
    return Effect.gen(function* () {
      const runner = yield* makeClaudeCodeRunner({ timeout: "1 minute" })
      const fiber = yield* Effect.forkChild(Effect.flip(runner.generate(input)))
      // wait (in real time) until the child has been spawned
      while (fake.records.length === 0) {
        yield* Effect.promise(() => new Promise((r) => setTimeout(r, 5)))
      }
      yield* TestClock.adjust("2 minutes")
      const error = yield* Fiber.join(fiber)
      expect(error._tag).toBe("Timeout")
      expect(fake.records[0]!.killed).toBe(true)
      expect(existsSync(fake.records[0]!.cwd!)).toBe(false)
    }).pipe(Effect.provide(fake.layer))
  })
})

describe("model provenance", () => {
  it.effect("Claude without modelUsage echoes the requested model, labelled as requested", () => {
    const { modelUsage: _, ...rest } = JSON.parse(fixture("claude-output.success.json"))
    const fake = withSpawner(() => ({ exitCode: 0, stdout: JSON.stringify(rest) }))
    return Effect.gen(function* () {
      const runner = yield* makeClaudeCodeRunner({ model: "opus" })
      const result = yield* runner.generate(input)
      expect(result.model).toBe("opus")
      expect(result.modelSource).toBe("requested")
    }).pipe(Effect.provide(fake.layer))
  })

  it.effect("Codex never reports its model: a requested one is labelled as requested", () => {
    const fake = withSpawner((rec) => {
      writeFileSync(rec.args[rec.args.indexOf("-o") + 1]!, '{"ok":true}')
      return { exitCode: 0, stdout: fixture("codex-events.success.jsonl") }
    })
    return Effect.gen(function* () {
      const requested = yield* (yield* makeCodexRunner({ model: "gpt-test" })).generate(input)
      expect(requested.model).toBe("gpt-test")
      expect(requested.modelSource).toBe("requested")
      const defaulted = yield* (yield* makeCodexRunner()).generate(input)
      expect(defaulted.model).toBeNull()
      expect(defaulted.modelSource).toBeNull()
    }).pipe(Effect.provide(fake.layer))
  })
})

describe("CodexRunner", () => {
  const writeOutput = (args: ReadonlyArray<string>, text: string) => {
    const out = args[args.indexOf("-o") + 1]!
    writeFileSync(out, text)
  }

  it.effect("writes the schema file, sends system+prompt on stdin, reads -o output", () => {
    let schemaSeen: unknown
    const fake = withSpawner((rec) => {
      schemaSeen = JSON.parse(
        readFileSync(rec.args[rec.args.indexOf("--output-schema") + 1]!, "utf8"),
      )
      writeOutput(rec.args, '{"ok":true}')
      return { exitCode: 0, stdout: fixture("codex-events.success.jsonl") }
    })
    return Effect.gen(function* () {
      const runner = yield* makeCodexRunner()
      const result = yield* runner.generate(input)
      expect(result.value).toEqual({ ok: true })
      expect(result.usage).toEqual({ inputTokens: 15835, outputTokens: 15, costUsd: null })
      expect(result.model).toBeNull()
      expect(fake.records[0]!.args).toContain("--ignore-user-config")
      expect(fake.records[0]!.args).toContain("features.hooks=false")
      expect(schemaSeen).toEqual(OkSchema.jsonSchema)
      const rec = fake.records[0]!
      expect(rec.stdin.startsWith(`${ANALYSIS_MARKER}\n`)).toBe(true)
      expect(rec.stdin).toContain("SYSTEM INSTRUCTIONS")
      expect(rec.stdin.endsWith("secret user prompt text")).toBe(true)
      expect(rec.args.join(" ")).not.toContain("secret")
      expect(rec.args.map((a) => a.replace(rec.cwd!, "<tmp>"))).toMatchSnapshot()
    }).pipe(Effect.provide(fake.layer))
  })

  it.effect.each([
    [
      "schema rejected → ProcessFailed",
      fixture("codex-events.schema-error.jsonl"),
      1,
      "ProcessFailed",
    ],
    ["usage limit → RateLimited", fixture("codex-events.rate-limit.jsonl"), 1, "RateLimited"],
    ["no output file → InvalidOutput", fixture("codex-events.success.jsonl"), 0, "InvalidOutput"],
  ] as const)("%s", ([, stdout, exitCode, tag]) => {
    const fake = withSpawner(() => ({ exitCode, stdout }))
    return Effect.gen(function* () {
      const runner = yield* makeCodexRunner()
      const error = yield* Effect.flip(runner.generate(input))
      expect(error._tag).toBe(tag)
    }).pipe(Effect.provide(fake.layer))
  })
})

describe("classifyFailure", () => {
  const base = {
    runner: "claude-code" as const,
    exitCode: 1,
    message: "",
    status: null,
    stderrTail: "",
  }
  it.each([
    ["http-401", { ...base, status: 401 }, "NotLoggedIn"],
    ["auth-message", { ...base, message: "Not logged in · Please run /login" }, "NotLoggedIn"],
    ["http-429", { ...base, status: 429 }, "RateLimited"],
    ["rate-limit-message", { ...base, stderrTail: "Claude usage limit reached" }, "RateLimited"],
    ["(none)", { ...base, message: "something else" }, "ProcessFailed"],
  ] as const)("rule %s", (rule, info, tag) => {
    expect(classifyFailure(info)._tag).toBe(tag)
    expect(CLASSIFY_RULES.find((r) => r.test(info))?.name ?? "(none)").toBe(rule)
  })

  it("sanitizeStderr drops prompt lines and keeps the last 20", () => {
    const stderr = [
      "warn 1",
      "secret user prompt text",
      ...Array.from({ length: 30 }, (_, i) => `line ${i}`),
    ].join("\n")
    const out = sanitizeStderr(stderr, "secret user prompt text")
    expect(out).not.toContain("secret")
    expect(out.split("\n")).toHaveLength(20)
  })
})

describe("withRetry", () => {
  const ok = { ok: true }
  it.effect("retries InvalidOutput with an explanation, then succeeds", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({
        failures: new Map([[1, new InvalidOutput({ runner: "claude-code", detail: "bad field" })]]),
        respond: () => ok,
      })
      const fiber = yield* Effect.forkChild(withRetry(fake).generate(input))
      yield* TestClock.adjust("1 minute")
      const result = yield* Fiber.join(fiber)
      expect(result.value).toEqual(ok)
      expect(fake.calls()).toBe(2)
      expect(fake.log[1]!.prompt).toContain("bad field")
    }),
  )

  it.effect("gives up after 2 retries", () =>
    Effect.gen(function* () {
      const err = new RateLimited({ runner: "codex", detail: "x" })
      const fake = makeFakeLlmRunner({
        failures: new Map([
          [1, err],
          [2, err],
          [3, err],
        ]),
        respond: () => ok,
      })
      const fiber = yield* Effect.forkChild(Effect.flip(withRetry(fake).generate(input)))
      yield* TestClock.adjust("10 minutes")
      expect((yield* Fiber.join(fiber))._tag).toBe("RateLimited")
      expect(fake.calls()).toBe(3)
    }),
  )

  it.effect("does not retry NotLoggedIn", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({
        failures: new Map([[1, new NotLoggedIn({ runner: "codex", detail: "x" })]]),
        respond: () => ok,
      })
      const error = yield* Effect.flip(withRetry(fake).generate(input))
      expect(error._tag).toBe("NotLoggedIn")
      expect(fake.calls()).toBe(1)
    }),
  )

  it("RateLimited waits at least 30s; others back off exponentially", () => {
    const rl: LlmError = new RateLimited({ runner: "codex", detail: "" })
    const io: LlmError = new InvalidOutput({ runner: "codex", detail: "" })
    expect(retryDelay(rl, 0).toString()).toContain("30000")
    expect(retryDelay(io, 0).toString()).toContain("2000")
    expect(retryDelay(io, 1).toString()).toContain("4000")
  })
})

describe("FakeLlmRunner", () => {
  it.effect("answers by hash and reports the hash when missing", () =>
    Effect.gen(function* () {
      const hash = fakeHash(input.system, input.prompt)
      const fake = makeFakeLlmRunner({ responses: { [hash]: { ok: false } } })
      expect((yield* fake.generate(input)).value).toEqual({ ok: false })
      const error = yield* Effect.flip(fake.generate({ ...input, prompt: "other" }))
      expect(error._tag === "InvalidOutput" && error.detail).toContain(
        fakeHash(input.system, "other"),
      )
      expect(fake.calls()).toBe(2)
    }),
  )
})

describe("detect", () => {
  it("parses claude auth status", () => {
    expect(parseClaudeAuth('{"loggedIn": true, "email": "x"}')).toBe(true)
    expect(parseClaudeAuth('{"loggedIn": false}')).toBe(false)
    expect(parseClaudeAuth("garbage")).toBeNull()
  })
  it("reads only the plan from claude auth status, never the email or organization", () => {
    const stdout = JSON.stringify({
      loggedIn: true,
      authMethod: "claude.ai",
      email: "dev@example.com",
      orgId: "org-123",
      orgName: "Example Org",
      subscriptionType: "team",
    })
    const plan = parseClaudePlan(stdout)
    expect(plan).toEqual({ kind: "subscription", name: "team", detail: null })
    for (const secret of ["dev@example.com", "org-123", "Example Org"])
      expect(JSON.stringify(plan)).not.toContain(secret)
    expect(parseClaudePlan('{"loggedIn": true, "authMethod": "api_key"}')).toEqual({
      kind: "api-key",
      name: null,
      detail: null,
    })
    expect(parseClaudePlan('{"loggedIn": true}')).toEqual({
      kind: "unknown",
      name: null,
      detail: null,
    })
    expect(parseClaudePlan("garbage")).toBeNull()
  })
  it("parses codex login status", () => {
    expect(parseCodexLogin({ exitCode: 0, stdout: "Logged in using ChatGPT", stderr: "" })).toBe(
      true,
    )
    // codex 0.164 writes the status to stderr
    expect(parseCodexLogin({ exitCode: 0, stdout: "", stderr: "Logged in using ChatGPT" })).toBe(
      true,
    )
    expect(parseCodexLogin({ exitCode: 1, stdout: "", stderr: "Not logged in" })).toBe(false)
  })
  describe("detectRunner", () => {
    const detect = (respond: Respond) => {
      const spawner = makeFakeSpawner(respond)
      return detectRunner("claude-code").pipe(Effect.provide(spawner.layer))
    }

    it.effect("reads the version, the login state and the plan", () =>
      Effect.gen(function* () {
        const status = yield* detect((r) =>
          r.args[0] === "--version"
            ? { exitCode: 0, stdout: "2.1.309 (Claude Code)" }
            : { exitCode: 0, stdout: '{"loggedIn": true, "subscriptionType": "max"}' },
        )
        expect(status).toEqual({
          id: "claude-code",
          installed: true,
          version: "2.1.309",
          loggedIn: true,
          plan: { kind: "subscription", name: "max", detail: null },
        })
      }),
    )

    it.effect("command not found → not installed", () =>
      Effect.gen(function* () {
        const status = yield* detect(() => "enoent")
        expect(status.installed).toBe(false)
      }),
    )

    it.effect("a CLI too slow to answer is installed, state unknown (the first call decides)", () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(detect(() => "hang"))
        yield* TestClock.adjust("1 minute")
        const status = yield* Fiber.join(fiber)
        expect(status).toEqual({
          id: "claude-code",
          installed: true,
          version: null,
          loggedIn: null,
        })
      }),
    )
  })

  it.effect("prefers Claude Code, honours --engine, reports why nothing is usable", () =>
    Effect.gen(function* () {
      const claude = { id: "claude-code" as const, installed: true, version: "2", loggedIn: true }
      const codex = { id: "codex" as const, installed: true, version: "0.1", loggedIn: true }
      expect((yield* chooseRunner([claude, codex], null)).id).toBe("claude-code")
      expect((yield* chooseRunner([claude, codex], "codex")).id).toBe("codex")
      expect((yield* chooseRunner([{ ...claude, loggedIn: false }, codex], null)).id).toBe("codex")
      const e1 = yield* Effect.flip(
        chooseRunner(
          [
            { ...claude, loggedIn: false },
            { ...codex, installed: false },
          ],
          null,
        ),
      )
      expect(e1._tag).toBe("NotLoggedIn")
      const e2 = yield* Effect.flip(
        chooseRunner(
          [
            { ...claude, installed: false },
            { ...codex, installed: false },
          ],
          null,
        ),
      )
      expect(e2._tag).toBe("NotInstalled")
    }),
  )
})
