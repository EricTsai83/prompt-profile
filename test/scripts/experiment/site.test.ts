import { describe, expect, it } from "vitest"
import { escapeHtml, jsonForScript } from "../../../scripts/experiment/site.ts"

// Built from code points: these characters end a line inside a <script> in old engines.
const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)

describe("jsonForScript", () => {
  it("cannot close or comment out the data block, and round-trips", () => {
    const hostile = { text: `</script><!-- & ${LS}${PS} <img onerror=x>` }
    const out = jsonForScript(hostile)
    for (const ch of ["<", ">", "&", LS, PS]) expect(out).not.toContain(ch)
    expect(JSON.parse(out)).toEqual(hostile)
  })
})

describe("escapeHtml", () => {
  it("escapes every markup and attribute character", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    )
  })
})
