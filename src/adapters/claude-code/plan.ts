import { Effect, type FileSystem } from "effect"
import { planCode, UNKNOWN_PLAN, type PlanInfo } from "../../domain/index.ts"

/**
 * An undocumented hint about the Claude plan from Claude Code's config file (plan 23): only
 * `oauthAccount.userRateLimitTier`, kept as `detail`. The plan itself comes from
 * `claude auth status` (llm/detect.ts). The file also holds the email and account ids: they
 * are never read into the result.
 */
export const readClaudePlanHint = (
  fs: FileSystem.FileSystem,
  configFile: string,
): Effect.Effect<PlanInfo> =>
  fs.readFileString(configFile).pipe(
    Effect.map((text): PlanInfo => {
      try {
        const json = JSON.parse(text) as { oauthAccount?: { userRateLimitTier?: unknown } } | null
        const detail = planCode(json?.oauthAccount?.userRateLimitTier)
        return detail === null ? UNKNOWN_PLAN : { ...UNKNOWN_PLAN, detail }
      } catch {
        return UNKNOWN_PLAN
      }
    }),
    Effect.orElseSucceed(() => UNKNOWN_PLAN),
  )
