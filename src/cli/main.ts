import { Effect, Option } from "effect"
import { Argument, Command, Flag } from "effect/cli"
import { CliError } from "effect/cli"
import { fileCacheLayer } from "../analysis/cache.ts"
import type { Language } from "../domain/Profile.ts"
import type { RunnerId } from "../llm/LlmRunner.ts"
import { Environment } from "../platform/Environment.ts"
import { VERSION } from "../version.ts"
import { Exit } from "./errors.ts"
import { renderError, verboseDetail, type AppError } from "./render-error.ts"
import { runMain } from "./commands/analyze.ts"
import { runCacheClear } from "./commands/cache.ts"
import { runRender } from "./commands/render.ts"
import { runStats } from "./commands/stats.ts"
import { DEFAULT_OUT, resolveLanguage } from "./options.ts"
import { cacheDirOf } from "./steps.ts"
import { makeOutput, Output } from "./services.ts"

const since = Flag.String("since").pipe(
  Flag.withDescription("Time range: 1m, 3m, 6m, 1y or all"),
  Flag.withDefault("6m"),
)
const out = Flag.String("out").pipe(
  Flag.withDescription("Output folder"),
  Flag.withDefault(DEFAULT_OUT),
)
const langFlag = (description: string) =>
  Flag.Literals("lang", ["zh-TW", "en"]).pipe(Flag.withDescription(description), Flag.optional)
const lang = langFlag("Language of the report and messages (default: from your system locale)")
const messageLang = langFlag("Language of messages (default: from your system locale)")
const verbose = Flag.Boolean("verbose").pipe(
  Flag.withDescription("Show full errors and LLM call timings"),
  Flag.withDefault(false),
)

const optional = <A>(o: Option.Option<A>): A | undefined => Option.getOrUndefined(o)

/** Run a command body: render any AppError, then fail with the right exit code. */
const handle = <R>(
  body: (language: Language) => Effect.Effect<void, AppError, R>,
  flags: { readonly lang: Option.Option<Language>; readonly verbose: boolean },
) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const language = resolveLanguage(optional(flags.lang), env.locale)
    const output = makeOutput({ isTTY: env.isTTY, verbose: flags.verbose })
    return yield* body(language).pipe(
      Effect.provideService(Output, output),
      Effect.catch((error: AppError) =>
        Effect.gen(function* () {
          const { message, code } = renderError(error, language)
          yield* output.error(`\n✖ ${message}`)
          yield* output.debug(verboseDetail(error))
          return yield* new Exit({ code })
        }),
      ),
    )
  })

/** The analysis cache lives in the user's cache dir (resolved from Environment). */
const withCache = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    return yield* eff.pipe(Effect.provide(fileCacheLayer(yield* cacheDirOf)))
  })

const statsCommand = Command.make("stats", { since, out, lang: messageLang, verbose }, (f) =>
  handle((language) => runStats({ since: f.since, out: f.out }, language), f),
).pipe(Command.withDescription("Show statistics only (no LLM, free and fast); writes stats.json"))

const renderCommand = Command.make(
  "render",
  {
    file: Argument.String("profile.json").pipe(
      Argument.withDescription("A profile.json produced earlier"),
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription("Output folder (default: next to profile.json)"),
      Flag.optional,
    ),
    lang: langFlag(
      "Language of messages; the report keeps the language of profile.json (default: system locale)",
    ),
    verbose,
  },
  (f) => handle((language) => runRender({ file: f.file, out: optional(f.out) }, language), f),
).pipe(Command.withDescription("Re-create report.html and card.png from an existing profile.json"))

const cacheClearCommand = Command.make("clear", { lang: messageLang, verbose }, (f) =>
  handle((language) => withCache(runCacheClear(language)), f),
).pipe(Command.withDescription("Delete the analysis cache (it contains prompt excerpts)"))

const cacheCommand = Command.make("cache").pipe(
  Command.withDescription("Manage the analysis cache"),
  Command.withSubcommands([cacheClearCommand]),
)

export const command = Command.make(
  "prompt-profile",
  {
    since,
    engine: Flag.Literals("engine", ["claude", "codex"]).pipe(
      Flag.withDescription("Which CLI analyses your prompts (default: auto, Claude Code first)"),
      Flag.optional,
    ),
    model: Flag.String("model").pipe(
      Flag.withDescription("Model passed to claude / codex"),
      Flag.optional,
    ),
    lang,
    out,
    full: Flag.Boolean("full").pipe(
      Flag.withDescription("Analyse everything, no sampling (slower, uses more quota)"),
      Flag.withDefault(false),
    ),
    cache: Flag.Boolean("cache").pipe(
      Flag.withDescription("Read cached analysis results (--no-cache to skip)"),
      Flag.withDefault(true),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Skip the confirmation step"),
      Flag.withDefault(false),
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDescription("Write what would be sent to the LLM into --out, without calling it"),
      Flag.withDefault(false),
    ),
    verbose,
  },
  (f) =>
    handle(
      (language) =>
        withCache(
          runMain(
            {
              since: f.since,
              engine: ((e) =>
                e === undefined ? undefined : e === "claude" ? "claude-code" : "codex")(
                optional(f.engine),
              ) as RunnerId | undefined,
              model: optional(f.model),
              out: f.out,
              full: f.full,
              cache: f.cache,
              yes: f.yes,
              dryRun: f.dryRun,
            },
            language,
          ),
        ),
      f,
    ),
).pipe(
  Command.withDescription(
    "Analyse your Claude Code / Codex prompts locally and generate a personal profile.",
  ),
  Command.withSubcommands([statsCommand, renderCommand, cacheCommand]),
)

/** Parse errors are already rendered by effect/cli; map them to exit code 2. */
const mapCliErrors = <A, R>(self: Effect.Effect<A, Exit | CliError.CliError, R>) =>
  self.pipe(
    Effect.catchIf(CliError.isCliError, (e: CliError.CliError) =>
      e._tag === "ShowHelp" && e.errors.length === 0
        ? Effect.void
        : Effect.fail(new Exit({ code: 2 })),
    ),
  )

export const cli = Command.run(command, { version: VERSION }).pipe(mapCliErrors)

/** Same as `cli` with explicit arguments (tests). */
export const runCli = (args: ReadonlyArray<string>) =>
  Command.runWith(command, { version: VERSION })(args).pipe(mapCliErrors)
