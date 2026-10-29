import { Effect, Option } from "effect"
import { Argument, Command, Flag } from "effect/cli"
import { CliError } from "effect/cli"
import { fileCacheLayer } from "../analysis/cache.ts"
import type { RunnerId } from "../llm/LlmRunner.ts"
import { Environment } from "../platform/Environment.ts"
import { VERSION } from "../version.ts"
import { Exit } from "./errors.ts"
import {
  defectDetail,
  renderDefect,
  renderError,
  verboseDetail,
  type AppError,
} from "./render-error.ts"
import { runFlags, runMain, type MainOptions } from "./commands/analyze.ts"
import { runCacheClear } from "./commands/cache.ts"
import { runRender } from "./commands/render.ts"
import { runStats } from "./commands/stats.ts"
import { CHECK_MODES } from "../pipeline/audit.ts"
import { LOOK_IDS } from "../report/looks.ts"
import { DEFAULT_OUT, launcherOf, rerunCommand } from "./options.ts"
import { cacheDirOf } from "./steps.ts"
import { makeOutput, Output } from "./services.ts"

const since = Flag.String("since").pipe(
  Flag.withDescription("Time range: 1m, 3m, 6m, 1y or all"),
  Flag.withDefault("3m"),
)
const out = Flag.String("out").pipe(
  Flag.withDescription("Output folder"),
  Flag.withDefault(DEFAULT_OUT),
)
const verbose = Flag.Boolean("verbose").pipe(
  Flag.withDescription("Show full errors and LLM call timings"),
  Flag.withDefault(false),
)

const look = Flag.Literals("look", LOOK_IDS).pipe(
  Flag.withDescription(
    "Report and card design: prism (clear overview), slate (compact workspace), folio (narrative reading); classic is default (render only)",
  ),
  Flag.withDefault("classic" as const),
)
const lang = Flag.String("lang").pipe(
  Flag.withDescription(
    "Report languages, the first is the default: en, zh-TW (default: from the system locale)",
  ),
  Flag.optional,
)
const cardHide = Flag.String("card-hide").pipe(
  Flag.withDescription("Leave parts out of the card: comma list of traits, stats, graphic"),
  Flag.optional,
)
const name = Flag.String("name").pipe(
  Flag.withDescription(
    'Your name in the report title, e.g. --name Eric → "Eric’s prompt profile" (render only, not stored in profile.json)',
  ),
  Flag.optional,
)
const check = Flag.Literals("check", CHECK_MODES).pipe(
  Flag.withDescription(
    "Final check for personal data (email, home path, username, phone…): mask (default), warn keeps it, strict writes nothing. Secrets are always masked",
  ),
  Flag.withDefault("mask" as const),
)
const allow = Flag.String("allow").pipe(
  Flag.withDescription("Personal-data rules the final check skips: comma list, e.g. email"),
  Flag.optional,
)
const exclude = Flag.String("exclude").pipe(
  Flag.withDescription(
    "Leave parts out of the report: comma list of quotes, projects, dates, coaching, funfacts, custom-names, usage, or personal (all of them)",
  ),
  Flag.optional,
)

const optional = <A>(o: Option.Option<A>): A | undefined => Option.getOrUndefined(o)

/**
 * Run a command body: render any AppError — or, for a bug (defect), a short message with
 * the stack only under --verbose — then fail with the right exit code. `rerun` builds the
 * command that repeats an analysis with the cache (from how prompt-profile was started), for
 * errors that can be recovered that way.
 */
const handle = <R>(
  body: Effect.Effect<void, AppError, R>,
  flags: { readonly verbose: boolean },
  rerun?: (launcher: string) => string,
) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const output = makeOutput({ isTTY: env.isTTY, verbose: flags.verbose })
    return yield* body.pipe(
      Effect.provideService(Output, output),
      Effect.catch((error: AppError) =>
        Effect.gen(function* () {
          const { message, code } = renderError(error, rerun?.(launcherOf(env.env, VERSION)))
          yield* output.error(`\n✖ ${message}`)
          yield* output.debug(verboseDetail(error))
          return yield* new Exit({ code })
        }),
      ),
      Effect.catchDefect((defect) =>
        Effect.gen(function* () {
          const { message, code } = renderDefect()
          yield* output.error(`\n✖ ${message}`)
          yield* output.debug(defectDetail(defect))
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

const statsCommand = Command.make("stats", { since, out, verbose }, (f) =>
  handle(runStats({ since: f.since, out: f.out }), f),
).pipe(
  Command.withDescription(
    "Show statistics only: no LLM call and nothing leaves this computer (free); writes stats.json",
  ),
)

const renderCommand = Command.make(
  "render",
  {
    file: Argument.String("profile.json").pipe(
      Argument.withDescription("A profile.json produced earlier"),
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription(
        "Output folder (default: next to profile.json; with --look / --card-hide / --exclude, variants/<name>/)",
      ),
      Flag.optional,
    ),
    look,
    cardHide,
    exclude,
    name,
    check,
    allow,
    verbose,
  },
  (f) =>
    handle(
      runRender({
        file: f.file,
        out: optional(f.out),
        look: f.look,
        cardHide: optional(f.cardHide),
        exclude: optional(f.exclude),
        name: optional(f.name),
        check: f.check,
        allow: optional(f.allow),
      }),
      f,
    ),
).pipe(Command.withDescription("Re-create report.html and card.png from an existing profile.json"))

const cacheClearCommand = Command.make("clear", { verbose }, (f) =>
  handle(withCache(runCacheClear), f),
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
    effort: Flag.String("effort").pipe(
      Flag.withDescription(
        "Reasoning effort passed to claude / codex: low, medium, high, xhigh or max (default: the CLI's)",
      ),
      Flag.optional,
    ),
    maxCalls: Flag.String("max-calls").pipe(
      Flag.withDescription(
        "Hard limit on LLM CLI calls, including merges and retries (default: none)",
      ),
      Flag.optional,
    ),
    out,
    lang,
    look,
    cardHide,
    exclude,
    name,
    check,
    allow,
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
      Flag.withDescription("Skip the confirmation before calls that use your subscription quota"),
      Flag.withDefault(false),
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDescription(
        "Free preview: write what would be sent (redacted prompt text) into --out, call no LLM",
      ),
      Flag.withDefault(false),
    ),
    verbose,
  },
  (f) => {
    const options: MainOptions = {
      since: f.since,
      engine: ((e) => (e === undefined ? undefined : e === "claude" ? "claude-code" : "codex"))(
        optional(f.engine),
      ) as RunnerId | undefined,
      model: optional(f.model),
      effort: optional(f.effort),
      maxCalls: optional(f.maxCalls),
      out: f.out,
      full: f.full,
      cache: f.cache,
      yes: f.yes,
      dryRun: f.dryRun,
      lang: optional(f.lang),
      look: f.look,
      cardHide: optional(f.cardHide),
      exclude: optional(f.exclude),
      name: optional(f.name),
      check: f.check,
      allow: optional(f.allow),
    }
    return handle(withCache(runMain(options)), f, (launcher) =>
      rerunCommand({ ...runFlags(options), launcher }),
    )
  },
).pipe(
  Command.withDescription(
    "Read your Claude Code / Codex prompt history on this computer, redact it, and analyse it with your logged-in claude or codex CLI (uses your subscription quota, no API key; selected redacted prompts leave this computer). Writes a local report. Free first: --dry-run or `prompt-profile stats`.",
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
