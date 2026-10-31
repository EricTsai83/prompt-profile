import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, normalize, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { parseAst } from "vitest/node"

/**
 * The module rules of AGENTS.md, checked on every `src/` import:
 * - a module is used by other modules only through its `index.ts` (its interface);
 * - dependencies point one way, as listed in ALLOWED;
 * - each source adapter is independent: it shares code only through `adapters/common/`.
 */
const ALLOWED: Readonly<Record<string, ReadonlyArray<string>>> = {
  domain: [],
  platform: ["domain"],
  llm: ["domain"],
  adapters: ["domain"],
  pipeline: ["domain"],
  analysis: ["domain", "llm", "pipeline", "platform"],
  report: ["domain", "platform"],
  cli: ["domain", "platform", "llm", "adapters", "pipeline", "analysis", "report"],
}
/** Root files: entry points and the package version. */
const ROOT_ALLOWED: Readonly<Record<string, ReadonlyArray<string>>> = {
  "bin.ts": ["cli"],
  "standalone.ts": ["platform", "bin.ts"],
  "version.ts": [],
}
const ROOT_IMPORTERS: Readonly<Record<string, ReadonlyArray<string>>> = {
  "bin.ts": ["standalone.ts"],
  "version.ts": ["cli"],
}

const files = (dir: string): Array<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  )

interface Import {
  readonly from: string
  readonly to: string
}

interface Specifiers {
  /** Every import, re-export, `import()` type, dynamic `import()` and `require` specifier. */
  readonly literal: ReadonlyArray<string>
  /** Dynamic imports whose specifier is computed: they cannot be checked. */
  readonly computed: number
}

/** A specifier node's value, or `null` when it is computed. */
const literalOf = (node: unknown): string | null => {
  const n = node as {
    type?: string
    value?: unknown
    expressions?: unknown[]
    quasis?: Array<{ value: { cooked: string } }>
  }
  if (n?.type === "Literal" && typeof n.value === "string") return n.value
  if (n?.type === "TemplateLiteral" && n.expressions?.length === 0)
    return n.quasis![0]!.value.cooked
  return null
}

/** Parse a TypeScript file (a real parser: strings and comments cannot hide or fake an import). */
const specifiersOf = (code: string): Specifiers => {
  const literal: Array<string> = []
  let computed = 0
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (node === null || typeof node !== "object") return
    const n = node as Record<string, unknown> & { type?: string }
    const source =
      n.type === "ImportDeclaration" ||
      n.type === "ExportAllDeclaration" ||
      n.type === "ExportNamedDeclaration" ||
      n.type === "ImportExpression" ||
      n.type === "TSImportType"
        ? n.source
        : n.type === "CallExpression" &&
            (n.callee as { type?: string; name?: string }).type === "Identifier" &&
            (n.callee as { name?: string }).name === "require"
          ? (n.arguments as Array<unknown>)[0]
          : undefined
    if (source !== undefined && source !== null) {
      const value = literalOf(source)
      if (value === null) computed++
      else literal.push(value)
    }
    for (const value of Object.values(n)) if (typeof value === "object") visit(value)
  }
  visit(parseAst(code, { lang: "ts" }).body)
  return { literal, computed }
}

const isRelative = (s: string) => s.startsWith("./") || s.startsWith("../")
const relativeImports = (code: string): Array<string> =>
  specifiersOf(code).literal.filter(isRelative)

const sources = files("src").map((file) => ({ file, ...specifiersOf(readFileSync(file, "utf8")) }))
const imports: ReadonlyArray<Import> = sources.flatMap(({ file, literal }) =>
  literal
    .filter(isRelative)
    .map((specifier) => ({ from: file, to: normalize(join(dirname(file), specifier)) })),
)

/** `src/<module>/…` → module; a root file → its file name. */
const unit = (file: string): string => relative("src", file).split("/")[0]!
const isModule = (name: string) => name in ALLOWED
const show = (list: ReadonlyArray<Import>) => list.map((i) => `${i.from} → ${i.to}`)

describe("import extraction", () => {
  it("finds every import form, in any quotes, spacing and around comments", () => {
    const code = [
      `import { a } from "../platform/a.ts"`,
      `import type { B } from '../platform/b.ts'`,
      `export * from "./c.ts"`,
      `export { d } from '../domain/d.ts'`,
      `const e = await import(/* lazy */ "../report/e.ts")`,
      "const f = await import(`../llm/f.ts`)",
      `const g = await import( "../analysis/g.ts" )`,
      `type H = import("../cli/h.ts").H`,
      `const start = "/*"`,
      `import { i } from "../pipeline/i.ts"`,
      `const end = "*/"`,
      `// import { j } from "../cli/j.ts"`,
      `/* import { k } from "../cli/k.ts" */`,
      `const url = "https://example.com/x" // from "../cli/l.ts"`,
      `import { Effect } from "effect"`,
    ].join("\n")
    expect(relativeImports(code)).toEqual([
      "../platform/a.ts",
      "../platform/b.ts",
      "./c.ts",
      "../domain/d.ts",
      "../report/e.ts",
      "../llm/f.ts",
      "../analysis/g.ts",
      "../cli/h.ts",
      "../pipeline/i.ts",
    ])
    expect(specifiersOf(code).computed).toBe(0)
  })

  it("counts dynamic imports whose specifier is computed", () => {
    expect(specifiersOf("await import(name)").computed).toBe(1)
    expect(specifiersOf("await import(`../${name}.ts`)").computed).toBe(1)
    expect(specifiersOf("require(name)").computed).toBe(1)
    expect(specifiersOf('await import( /* x */ "../a.ts" )').computed).toBe(0)
  })
})

describe("module boundaries", () => {
  it("every dynamic import has a literal specifier", () => {
    expect(sources.filter((s) => s.computed > 0).map((s) => s.file)).toEqual([])
  })

  it("every module folder is listed, and every module has an index.ts", () => {
    const folders = readdirSync("src", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .toSorted()
    expect(folders).toEqual(Object.keys(ALLOWED).toSorted())
    for (const m of folders) expect(files(`src/${m}`)).toContain(join("src", m, "index.ts"))
    const roots = readdirSync("src", { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => e.name)
      .toSorted()
    expect(roots).toEqual(Object.keys(ROOT_ALLOWED).toSorted())
  })

  it("other modules are used only through their index.ts", () => {
    const deep = imports.filter(
      (i) =>
        isModule(unit(i.to)) &&
        unit(i.from) !== unit(i.to) &&
        !i.to.endsWith(`${unit(i.to)}/index.ts`),
    )
    expect(show(deep)).toEqual([])
  })

  it("a module never imports its own index.ts", () => {
    const own = imports.filter(
      (i) => isModule(unit(i.from)) && i.to === join("src", unit(i.from), "index.ts"),
    )
    expect(show(own)).toEqual([])
  })

  it("dependencies point one way", () => {
    const wrong = imports.filter((i) => {
      const from = unit(i.from)
      const to = unit(i.to)
      if (from === to) return false
      if (!isModule(to)) return !(ROOT_IMPORTERS[to] ?? []).includes(from)
      return !(isModule(from) ? ALLOWED[from] : ROOT_ALLOWED[from])!.includes(to)
    })
    expect(show(wrong)).toEqual([])
  })

  it("each source adapter shares code only through adapters/common", () => {
    const source = (file: string) => relative("src/adapters", file).split("/")[0]!
    const crossing = imports.filter(
      (i) =>
        unit(i.from) === "adapters" &&
        unit(i.to) === "adapters" &&
        source(i.from) !== source(i.to) &&
        !["common", "index.ts"].includes(source(i.to)) &&
        source(i.from) !== "registry.ts" &&
        source(i.from) !== "index.ts",
    )
    expect(show(crossing)).toEqual([])
  })
})
