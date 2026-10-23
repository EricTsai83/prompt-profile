import { describe, expect, it } from "@effect/vitest"
import { resolveTimezone } from "../../src/platform/Environment.ts"

const links: Record<string, string> = {
  "/etc/localtime": "/var/db/timezone/zoneinfo/Asia/Taipei",
  "/etc/broken": "/nowhere/else",
}
const readLink = (p: string) => links[p]

describe("resolveTimezone", () => {
  it.each([
    ["IANA name", "Europe/Berlin", "UTC", "Europe/Berlin"],
    ["leading colon", ":Asia/Tokyo", "UTC", "Asia/Tokyo"],
    ["zoneinfo file", ":/etc/localtime", undefined, "Asia/Taipei"],
    ["unresolvable file → system zone", "/etc/broken", "America/New_York", "America/New_York"],
    ["POSIX rule → system zone", "CST-8", "Asia/Taipei", "Asia/Taipei"],
    ["unset → system zone", undefined, "Asia/Taipei", "Asia/Taipei"],
    ["nothing usable → UTC", "CST-8", undefined, "UTC"],
  ] as const)("%s", (_name, tz, system, expected) => {
    expect(resolveTimezone(tz, system, readLink)).toBe(expected)
  })
})
