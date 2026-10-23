import { Context, Layer } from "effect"
import { readlinkSync } from "node:fs"
import { homedir, userInfo } from "node:os"
import { isTimeZone } from "../domain/timezone.ts"

/**
 * Everything environment-dependent, behind one service so tests can replace it.
 * (Time comes from Effect's Clock; child processes from ChildProcessSpawner.)
 */
export interface EnvironmentShape {
  readonly home: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly cwd: string
  readonly timezone: string
  /** OS username (redacted from prompts); null when unknown. */
  readonly username: string | null
  /** stdin and stdout are both terminals. */
  readonly isTTY: boolean
  readonly platform: NodeJS.Platform
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
  return [fromFile, systemZone].find((z) => z !== undefined && z !== "" && isTimeZone(z)) ?? "UTC"
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
  return {
    home: homedir(),
    env: process.env,
    cwd: process.cwd(),
    timezone: resolveTimezone(process.env["TZ"], resolved.timeZone, safeReadLink),
    username: safeUsername(),
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    platform: process.platform,
  }
}

export const EnvironmentLive = Layer.sync(Environment, liveEnvironment)
