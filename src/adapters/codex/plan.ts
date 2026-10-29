import { Effect, type FileSystem, Option, Schema } from "effect"
import { planCode, UNKNOWN_PLAN, type PlanInfo } from "../../domain/Usage.ts"

/**
 * The ChatGPT plan Codex runs on, from `auth.json` (plan 23; undocumented format). Only the
 * payload of `tokens.id_token` is decoded, locally, and only `chatgpt_plan_type` is kept: no
 * token, email, account id or other claim leaves this function, not even in an error.
 */
const AuthFile = Schema.Struct({
  auth_mode: Schema.optional(Schema.Unknown),
  OPENAI_API_KEY: Schema.optional(Schema.Unknown),
  tokens: Schema.optional(
    Schema.NullOr(Schema.Struct({ id_token: Schema.optional(Schema.Unknown) })),
  ),
})
const decodeAuth = Schema.decodeUnknownOption(AuthFile)

const AUTH_CLAIM = "https://api.openai.com/auth"

const planTypeOf = (idToken: unknown): string | null => {
  if (typeof idToken !== "string") return null
  const payload = idToken.split(".")[1]
  if (payload === undefined) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown
    const auth = (claims as Record<string, unknown> | null)?.[AUTH_CLAIM]
    return planCode((auth as Record<string, unknown> | null | undefined)?.["chatgpt_plan_type"])
  } catch {
    return null
  }
}

export const readCodexPlan = (
  fs: FileSystem.FileSystem,
  authFile: string,
): Effect.Effect<PlanInfo> =>
  fs.readFileString(authFile).pipe(
    Effect.map((text): PlanInfo => {
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        return UNKNOWN_PLAN
      }
      const auth = decodeAuth(json)
      if (Option.isNone(auth)) return UNKNOWN_PLAN
      const { auth_mode: mode, OPENAI_API_KEY: key, tokens } = auth.value
      if (mode === "apikey" || (typeof key === "string" && key !== "" && !tokens))
        return { kind: "api-key", name: null, detail: null }
      const name = planTypeOf(tokens?.id_token)
      return name === null ? UNKNOWN_PLAN : { kind: "subscription", name, detail: null }
    }),
    Effect.orElseSucceed(() => UNKNOWN_PLAN),
  )
