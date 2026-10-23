import { Context, Layer } from "effect"
import { readlinkSync } from "node:fs"
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
  readonly fetchFont?: ((url: string, signal: AbortSignal) => Promise<Uint8Array>) | undefined
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

const isTimezone = (zone: string): boolean => {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone !== ""
  } catch {
    return false
  }
}

/**
 * IANA time zone for stats and chunking. `TZ` may use POSIX forms Intl rejects:
 * `:Asia/Taipei`, `:/etc/localtime` (a link into zoneinfo) or a rule like `CST-8`.
 * Falls back to the system zone, then UTC — never an invalid zone (Intl would throw).
 */
export const resolveTimezone = (
  tz: string | undefined,
  systemZone: string | undefined,
  readLink: (path: string) => string | undefined,
): string => {
  const name = tz?.replace(/^:/, "")
  const fromFile = name?.startsWith("/") ? /zoneinfo\/(.+)$/.exec(readLink(name) ?? "")?.[1] : name
  return [fromFile, systemZone].find((z) => z !== undefined && z !== "" && isTimezone(z)) ?? "UTC"
}

const safeReadLink = (path: string): string | undefined => {
  try {
    return readlinkSync(path)
  } catch {
    return undefined
  }
}

export const liveEnvironment = (): EnvironmentShape => {
  const resolved = Intl.DateTimeFormat().resolvedOptions()
  const envLocale = process.env["LC_ALL"] || process.env["LC_MESSAGES"] || process.env["LANG"]
  return {
    home: homedir(),
    env: process.env,
    cwd: process.cwd(),
    timezone: resolveTimezone(process.env["TZ"], resolved.timeZone, safeReadLink),
    locale: envLocale ? envLocale.replace(/[.@].*$/, "").replace("_", "-") : resolved.locale,
    username: safeUsername(),
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    platform: process.platform,
  }
}

export const EnvironmentLive = Layer.sync(Environment, liveEnvironment)
