import { describe, expect, it } from "@effect/vitest"
import { luhnValid, makeRules, projectName, redact } from "../../src/pipeline/redact.ts"

const rules = makeRules("alice")
const run = (text: string) => {
  const counts: Record<string, number> = {}
  return { text: redact(text, rules, counts), counts }
}

describe("redact: must redact", () => {
  it.each([
    // api tokens
    ["api-token", "use sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv here", "use [SECRET] here"],
    ["api-token", "token ghp_1234567890abcdefghijABCDEFGHIJ0123", "token [SECRET]"],
    ["api-token", "AWS key AKIAIOSFODNN7EXAMPLE ok", "AWS key [SECRET] ok"],
    ["api-token", "slack xoxb-123456789012-abcdefABCDEF", "slack [SECRET]"],
    // jwt
    [
      "jwt",
      "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      "jwt [SECRET]",
    ],
    // key = value
    ["key-value-secret", "password=hunter22", "password=[SECRET]"],
    ["key-value-secret", 'API_KEY: "abcd1234efgh"', 'API_KEY: "[SECRET]"'],
    ["key-value-secret", "set token = s3cr3t-value", "set token = [SECRET]"],
    // bearer
    ["bearer", "Authorization: Bearer abc.def.ghi123", "Authorization: Bearer [SECRET]"],
    [
      "bearer",
      "curl -H 'Authorization: Basic dXNlcjpwYXNz'",
      "curl -H 'Authorization: Basic [SECRET]'",
    ],
    ["bearer", "Token 0123456789abcdefXYZ", "Token [SECRET]"],
    // private key
    [
      "private-key",
      "key:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----\ndone",
      "key:\n[SECRET]\ndone",
    ],
    ["private-key", "-----BEGIN OPENSSH PRIVATE KEY-----\nb3Bl", "[SECRET]"],
    ["private-key", "x -----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY----- y", "x [SECRET] y"],
    // connection strings
    [
      "connection-string",
      "postgres://admin:pa55@db.example.com/app",
      "postgres://[SECRET]@db.example.com/app",
    ],
    [
      "connection-string",
      "mongodb+srv://u:p@cluster0.mongodb.net",
      "mongodb+srv://[SECRET]@cluster0.mongodb.net",
    ],
    ["connection-string", "redis://default:secret@cache:6379", "redis://[SECRET]@cache:6379"],
    // email
    ["email", "mail me at alice.chen@example.com", "mail me at [EMAIL]"],
    ["email", "a+tag@sub.example.co.uk,", "[EMAIL],"],
    ["email", "git@github.com:org/repo", "[EMAIL]:org/repo"],
    // phone
    ["phone", "call 0912-345-678", "call [PHONE]"],
    ["phone", "手機 0912345678 謝謝", "手機 [PHONE] 謝謝"],
    ["phone", "office (02) 2345-6789", "office [PHONE]"],
    // national id / credit card
    ["tw-national-id", "身分證 A123456789", "身分證 [ID]"],
    ["tw-national-id", "id F223456789.", "id [ID]."],
    ["tw-national-id", "居留證 A812345678", "居留證 [ID]"],
    ["credit-card", "card 4111 1111 1111 1111", "card [ID]"],
    ["credit-card", "card 5555-5555-5555-4444", "card [ID]"],
    ["credit-card", "378282246310005", "[ID]"],
    // internal urls
    ["internal-url", "open http://192.168.1.20:8080/admin", "open [INTERNAL_URL]"],
    ["internal-url", "ssh 10.0.3.4", "ssh [INTERNAL_URL]"],
    ["internal-url", "see https://wiki.corp/page", "see [INTERNAL_URL]"],
    // home paths
    ["home-path", "/Users/bob/projects/x/index.ts", "~/projects/x/index.ts"],
    ["home-path", "cd /home/dev/repo", "cd ~/repo"],
    ["home-path", "C:\\Users\\Bob\\code", "~\\code"],
    // username
    ["username", "ask Alice about it", "ask [USER] about it"],
    ["username", "alice's branch", "[USER]'s branch"],
    ["username", "user=alice", "user=[USER]"],
    // high entropy
    ["high-entropy", "secret Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0Lm", "secret [SECRET]"],
    ["high-entropy", "k=AbC123dEf456GhI789jKl012MnO345pQr", "k=[SECRET]"],
    ["high-entropy", "aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE3fG5", "[SECRET]"],
    // uuid / hex hash (decision: redact — no profiling value, sometimes used as API keys)
    ["uuid", "session 123e4567-e89b-12d3-a456-426614174000", "session [UUID]"],
    ["hex-hash", "commit 9fceb02d0ae598e95dc970b74767f19372d61af8", "commit [HASH]"],
    ["hex-hash", "md5 d41d8cd98f00b204e9800998ecf8427e", "md5 [HASH]"],
  ] as const)("%s: %j", (rule, input, expected) => {
    const out = run(input)
    expect(out.text).toBe(expected)
    expect(out.counts[rule]).toBeGreaterThan(0)
  })
})

describe("redact: must NOT redact", () => {
  it.each([
    // long ordinary words / identifiers (no digits → not random)
    ["long English word", "internationalization and counterrevolutionaries"],
    ["long camelCase identifier", "rename getUserProfileSettingsFromLocalStorageCache"],
    ["file path inside a repo", "edit src/components/ProfileCard.tsx"],
    // numbers that are not phones / cards
    ["version numbers", "upgrade to 4.0.6 and node 24.11.1"],
    ["year and counts", "in 2026 we had 12345 users"],
    ["non-Luhn digit run", "order 1234567812345678"],
    // localhost is fine
    ["localhost", "open http://localhost:3000/dashboard"],
    ["loopback", "curl 127.0.0.1:8080"],
    ["public url", "see https://effect.website/docs"],
    // id-like but not a TW ID
    ["lowercase id", "a123456789"],
    ["short username substring", "aliceblue color"],
    ["key without value", "what is a password manager?"],
  ] as const)("%s", (_name, input) => {
    expect(run(input).text).toBe(input)
  })

  it("skips the username rule for short names", () => {
    expect(redact("ed is here", makeRules("ed"))).toBe("ed is here")
  })
})

describe("helpers", () => {
  it("luhn", () => {
    expect(luhnValid("4111111111111111")).toBe(true)
    expect(luhnValid("4111111111111112")).toBe(false)
  })
  it("project name keeps the last segment and is redacted", () => {
    expect(projectName("/Users/alice/work/drawstuff", rules)).toBe("drawstuff")
    expect(projectName("/home/x/alice", rules)).toBe("[USER]")
    expect(projectName("C:\\code\\app\\", rules)).toBe("app")
    expect(projectName(null, rules)).toBeNull()
  })
})
