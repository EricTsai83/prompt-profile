/** Hand-made credentials: none of these strings may ever leave the plan reader. */
export const FAKE_SECRETS = [
  "fake-access-token-abc123",
  "fake-refresh-token-def456",
  "acct-fake-0001",
  "user-fake-0002",
  "dev@example.com",
  "Dev Example",
  "sk-fake-api-key",
]

const b64url = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url")
const fakeJwt = (claims: object) => `${b64url({ alg: "none" })}.${b64url(claims)}.fake-signature`

export const fakeCodexAuth = (planType: unknown = "plus") => ({
  auth_mode: "chatgpt",
  OPENAI_API_KEY: null,
  tokens: {
    id_token: fakeJwt({
      email: "dev@example.com",
      name: "Dev Example",
      "https://api.openai.com/auth": {
        chatgpt_plan_type: planType,
        chatgpt_account_id: "acct-fake-0001",
        chatgpt_user_id: "user-fake-0002",
      },
    }),
    access_token: "fake-access-token-abc123",
    refresh_token: "fake-refresh-token-def456",
    account_id: "acct-fake-0001",
  },
  last_refresh: "2026-10-01T00:00:00Z",
})
