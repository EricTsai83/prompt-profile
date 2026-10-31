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
  "32": "c30c801e4ddedd8cfd247c8b053412f397429ad04989b84baea6d6ee045d2331",
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
