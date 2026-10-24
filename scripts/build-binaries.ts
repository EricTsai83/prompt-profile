/**
 * Standalone binaries (plan 19): `pnpm build:binaries [--target linux-x64,...] [--out dist-bin]`.
 * Cross-compiles `src/standalone.ts` with `bun build --compile` for every target, embedding
 * the files the program reads at runtime, and writes one
 * `prompt-profile-<version>-<target>.tar.gz` per target plus `SHA256SUMS`. Needs Bun.
 */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, join, resolve } from "node:path"
import { parseArgs } from "node:util"

export interface Target {
  /** Name in the archive file name. */
  readonly name: string
  /** `bun build --target`. */
  readonly bun: string
  readonly executable: string
}

export const TARGETS: ReadonlyArray<Target> = [
  { name: "darwin-arm64", bun: "bun-darwin-arm64", executable: "prompt-profile" },
  { name: "darwin-x64", bun: "bun-darwin-x64", executable: "prompt-profile" },
  { name: "linux-x64", bun: "bun-linux-x64", executable: "prompt-profile" },
  { name: "linux-arm64", bun: "bun-linux-arm64", executable: "prompt-profile" },
  { name: "windows-x64", bun: "bun-windows-x64", executable: "prompt-profile.exe" },
]

const repo = resolve(import.meta.dirname, "..")
const inRepo = (...parts: Array<string>) => join(repo, ...parts)
const filesIn = (dir: string, ext: string) =>
  readdirSync(inRepo(dir))
    .filter((f) => f.endsWith(ext))
    .map((f) => inRepo(dir, f))

/** Files read through `platform/assets.ts`, embedded by file name. */
const assets = (): Array<string> => {
  const files = [
    ...filesIn("src/analysis/prompts", ".md"),
    ...filesIn("src/report/fonts", ".woff"),
    createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"),
  ]
  const names = files.map((f) => basename(f))
  const duplicate = names.find((n, i) => names.indexOf(n) !== i)
  if (duplicate !== undefined) throw new Error(`Two embedded assets are named ${duplicate}`)
  return files
}

/** Shipped beside the executable: the licences of the program and of the embedded fonts. */
const DOCS = [inRepo("LICENSE"), inRepo("README.md"), ...filesIn("src/report/fonts", ".txt")]

const main = () => {
  const { values } = parseArgs({
    options: { target: { type: "string" }, out: { type: "string", default: "dist-bin" } },
  })
  const wanted = values.target?.split(",") ?? TARGETS.map((t) => t.name)
  const targets = wanted.map((name) => {
    const target = TARGETS.find((t) => t.name === name)
    if (target === undefined) throw new Error(`Unknown target ${name}`)
    return target
  })
  const version = (JSON.parse(readFileSync(inRepo("package.json"), "utf8")) as { version: string })
    .version
  const out = resolve(values.out)
  const staging = join(out, "staging")
  rmSync(out, { recursive: true, force: true })
  const embedded = assets()

  const archives: Array<string> = []
  for (const target of targets) {
    const folder = `prompt-profile-${version}-${target.name}`
    const dir = join(staging, folder)
    mkdirSync(dir, { recursive: true })
    execFileSync(
      "bun",
      [
        "build",
        "--compile",
        `--target=${target.bun}`,
        inRepo("src/standalone.ts"),
        ...embedded,
        "--loader",
        ".md:file",
        "--loader",
        ".wasm:file",
        "--asset-naming",
        "[name].[ext]",
        "--define",
        `__PKG_VERSION__=${JSON.stringify(version)}`,
        "--outfile",
        join(dir, target.executable),
      ],
      { cwd: repo, stdio: "inherit" },
    )
    for (const doc of DOCS) copyFileSync(doc, join(dir, basename(doc)))
    const archive = `${folder}.tar.gz`
    execFileSync("tar", ["-czf", join(out, archive), "-C", staging, folder], { stdio: "inherit" })
    archives.push(archive)
  }
  rmSync(staging, { recursive: true, force: true })

  const sums = archives
    .map(
      (a) =>
        `${createHash("sha256")
          .update(readFileSync(join(out, a)))
          .digest("hex")}  ${a}\n`,
    )
    .join("")
  writeFileSync(join(out, "SHA256SUMS"), sums)
  process.stdout.write(`Built ${archives.length} binaries in ${out}:\n${sums}`)
}

main()
