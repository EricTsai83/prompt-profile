import { Context, Layer } from "effect"
import { homedir, userInfo } from "node:os"

/**
 * Everything environment-dependent, behind one service so tests can replace it.
 * (Time comes from Effect's Clock; child processes from ChildProcessSpawner.)
 */
export interface EnvironmentShape {
  readonly home: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly cwd: string
  readonly timezone: string
  /** BCP 47 locale, e.g. "zh-TW" or "en-US". */
  readonly locale: string
  /** OS username (redacted from prompts); null when unknown. */
  readonly username: string | null
  /** stdin and stdout are both terminals. */
  readonly isTTY: boolean
  readonly platform: NodeJS.Platform
  /** Download used for the card font; undefined → global fetch. */
  readonly fetchFont?: ((url: string) => Promise<Uint8Array>) | undefined
}

export class Environment extends Context.Service<Environment, EnvironmentShape>()(
  "prompt-profile/Environment",
) {}

const safeUsername = (): string | null => {
  try {
    return userInfo().username || null
  } catch {
    return null
  }
}

export const liveEnvironment = (): EnvironmentShape => {
  const resolved = Intl.DateTimeFormat().resolvedOptions()
  const envLocale = process.env["LC_ALL"] || process.env["LC_MESSAGES"] || process.env["LANG"]
  return {
    home: homedir(),
    env: process.env,
    cwd: process.cwd(),
    timezone: process.env["TZ"] || resolved.timeZone || "UTC",
    locale: envLocale ? envLocale.replace(/[.@].*$/, "").replace("_", "-") : resolved.locale,
    username: safeUsername(),
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    platform: process.platform,
  }
}

export const EnvironmentLive = Layer.sync(Environment, liveEnvironment)
