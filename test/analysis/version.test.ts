import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { ANALYSIS_VERSION } from "../../src/analysis/version.ts"

const PROMPTS = "src/analysis/prompts"

/**
 * The analysis prompts each `ANALYSIS_VERSION` was released with. Cached map / merge results
 * are keyed by the version: a prompt edit without a bump would reuse results of the old prompts.
 * After editing a prompt, bump `ANALYSIS_VERSION` and record the new hash under the new version.
 */
const PROMPTS_OF_VERSION: Readonly<Record<string, string>> = {
  "37": "dc0c6a62ea0bc74e1e6bbe54c71cd62b28645cace2ca79222651e58cff741fc5",
  "36": "c473e8f3436e4c667d9bf8c70a09abe5cf3a02716c41723f4336b57a4ad8a87c",
  "35": "a6b788eaaf73367ec9acd30dab1608f00f73362f1af6d3c1111b5f342fd9b450",
  "34": "30f1cc6f1b649719283c7a69e129b32b7c77c69c1f03073f54eb9ce9f6418869",
}

it("an analysis prompt change bumps ANALYSIS_VERSION", () => {
  const hash = createHash("sha256")
  for (const name of readdirSync(PROMPTS).toSorted()) {
    hash
      .update(`${name}\0`)
      .update(readFileSync(`${PROMPTS}/${name}`, "utf8").replace(/\r\n/gu, "\n"))
  }
  expect({ version: ANALYSIS_VERSION, prompts: hash.digest("hex") }).toEqual({
    version: ANALYSIS_VERSION,
    prompts: PROMPTS_OF_VERSION[ANALYSIS_VERSION],
  })
})
