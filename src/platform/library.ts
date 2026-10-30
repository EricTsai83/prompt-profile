import { randomUUID, createHash } from "node:crypto"
import {
  mkdir,
  lstat,
  realpath,
  readdir,
  readFile,
  writeFile,
  chmod,
  rename,
  rm,
} from "node:fs/promises"
import { join, dirname, basename } from "node:path"
import {
  libraryIndex,
  parseRunManifest,
  RUN_ID,
  type LibraryIndex,
  type RunManifest,
} from "../domain/Library.ts"

const missing = (e: unknown) => (e as { code?: string }).code === "ENOENT"
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** Existing folders retain their permissions. Never traverse a library-owned symlink. */
const reportsDirectory = async (root: string, create: boolean): Promise<string> => {
  const directory = join(root, "reports")
  if (create) await mkdir(root, { recursive: true, mode: 0o700 })
  try {
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("The reports path must be a regular directory")
  } catch (e) {
    if (!missing(e) || !create) throw e
    await mkdir(directory, { mode: 0o700 }).catch((error: unknown) => {
      if ((error as { code?: string }).code !== "EEXIST") throw error
    })
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Unsafe reports path", { cause: e })
  }
  return directory
}

export const writeLibraryFile = async (file: string, data: string | Uint8Array): Promise<void> => {
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, data, { mode: 0o600, flag: "wx" })
    await chmod(temporary, 0o600)
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
}

export interface RunStage {
  readonly id: string
  readonly directory: string
}
export const createRunStage = async (root: string): Promise<RunStage> => {
  const reports = await reportsDirectory(root, true)
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z")
  const id = `${stamp}-${randomUUID().replaceAll("-", "")}`
  const directory = join(reports, `.pending-${id}`)
  await mkdir(directory, { mode: 0o700 })
  return { id, directory }
}

const regular = async (path: string) => {
  const info = await lstat(path)
  return info.isFile() && !info.isSymbolicLink()
}

/** The index is disposable; immutable completion manifests are the source of truth. */
export const scanLibrary = async (root: string): Promise<LibraryIndex> => {
  let reports: string
  try {
    reports = await reportsDirectory(root, false)
  } catch (e) {
    if (missing(e)) return libraryIndex([])
    throw e
  }
  const runs: Array<RunManifest> = []
  let skipped = 0
  for (const name of await readdir(reports)) {
    if (name.startsWith(".pending-")) continue
    if (!RUN_ID.test(name)) {
      skipped++
      continue
    }
    try {
      const directory = join(reports, name)
      const info = await lstat(directory)
      if (!info.isDirectory() || info.isSymbolicLink()) {
        skipped++
        continue
      }
      const manifestPath = join(directory, "run.json")
      const stat = await lstat(manifestPath)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64_000) {
        skipped++
        continue
      }
      const run = parseRunManifest(JSON.parse(await readFile(manifestPath, "utf8")))
      if (
        !run ||
        run.id !== name ||
        !(await regular(join(directory, "profile.json"))) ||
        !(await regular(join(directory, "report.html")))
      ) {
        skipped++
        continue
      }
      runs.push(run)
    } catch {
      skipped++
    }
  }
  return libraryIndex(runs, skipped)
}

/**
 * Concurrent writers rescan after publishing. A writer that overwrote a newer index sees
 * its additional completion manifests and republishes the union before returning success.
 * A crash can leave a stale index, but cannot remove a completed run; repair is analysis-free.
 */
export const repairLibrary = async (
  root: string,
  render: (index: LibraryIndex) => string,
): Promise<LibraryIndex> => {
  await reportsDirectory(root, true)
  for (let attempt = 0; attempt < 32; attempt++) {
    const index = await scanLibrary(root)
    await writeLibraryFile(join(root, "library.json"), json(index))
    await writeLibraryFile(join(root, "index.html"), render(index))
    const current = await scanLibrary(root)
    if (json(current) === json(index)) return current
  }
  throw new Error(
    "Reports kept arriving while rebuilding the library; run history again to repair its index",
  )
}

export const publishRun = async (
  root: string,
  stage: RunStage,
  manifest: RunManifest,
  render: (index: LibraryIndex) => string,
): Promise<{ readonly directory: string; readonly index: LibraryIndex }> => {
  const reports = await reportsDirectory(root, true)
  if (
    !RUN_ID.test(stage.id) ||
    manifest.id !== stage.id ||
    dirname(stage.directory) !== reports ||
    !basename(stage.directory).startsWith(".pending-") ||
    !RUN_ID.test(basename(stage.directory).slice(9)) ||
    !parseRunManifest(manifest)
  )
    throw new Error("Invalid report publication metadata")
  if (
    !(await regular(join(stage.directory, "profile.json"))) ||
    !(await regular(join(stage.directory, "report.html")))
  )
    throw new Error("A report must finish its profile and HTML before publication")
  await writeLibraryFile(join(stage.directory, "run.json"), json(manifest))
  const directory = join(reports, stage.id)
  try {
    await lstat(directory)
    throw new Error("A report with this id already exists")
  } catch (e) {
    if (!missing(e)) throw e
  }
  await rename(stage.directory, directory)
  try {
    const index = await repairLibrary(root, render)
    return { directory, index }
  } catch (e) {
    throw new Error(`Completed report retained at ${directory}; library index repair failed`, {
      cause: e,
    })
  }
}

/** Preserve legacy artifacts without changing or deleting any root-level original. */
export const preserveLegacy = async (
  root: string,
  base: RunManifest,
  fallbackHtml: string,
  render: (index: LibraryIndex) => string,
): Promise<string | null> => {
  const file = join(root, "profile.json")
  try {
    if (!(await regular(file))) return null
  } catch (e) {
    if (missing(e)) return null
    throw e
  }
  const data = await readFile(file)
  const fingerprint = createHash("sha256").update(data).digest("hex")
  if (base.legacyFingerprint && base.legacyFingerprint !== fingerprint)
    throw new Error("Legacy profile changed while preserving it; originals retained")
  const id = `legacy-${fingerprint.slice(0, 32)}`
  if ((await scanLibrary(root)).runs.some((r) => r.id === id)) return join(root, "reports", id)
  const temporary = await createRunStage(root)
  const stage = { ...temporary, id }
  const copyFile = async (from: string, to: string): Promise<boolean> => {
    try {
      if (!(await regular(from))) return false
      await writeLibraryFile(to, await readFile(from))
      return true
    } catch (e) {
      if (missing(e)) return false
      throw e
    }
  }
  const copyTree = async (from: string, to: string, depth = 0): Promise<void> => {
    if (depth > 16)
      throw new Error("Legacy variants exceed the supported nesting depth; originals retained")
    let info
    try {
      info = await lstat(from)
    } catch (e) {
      if (missing(e)) return
      throw e
    }
    if (!info.isDirectory() || info.isSymbolicLink()) return
    await mkdir(to, { mode: 0o700 })
    for (const name of await readdir(from)) {
      const child = await lstat(join(from, name))
      if (child.isSymbolicLink()) continue
      if (child.isDirectory()) await copyTree(join(from, name), join(to, name), depth + 1)
      else if (child.isFile()) await copyFile(join(from, name), join(to, name))
    }
  }
  try {
    await writeLibraryFile(join(stage.directory, "profile.json"), data)
    if (!(await copyFile(join(root, "report.html"), join(stage.directory, "report.html"))))
      await writeLibraryFile(join(stage.directory, "report.html"), fallbackHtml)
    const cards = []
    for (const c of base.cards) {
      const name = c.language === base.languages[0] ? "card.png" : `card.${c.language}.png`
      const copied = await copyFile(join(root, name), join(stage.directory, name))
      cards.push({
        language: c.language,
        file: copied ? name : null,
        error: copied ? null : "Legacy card unavailable",
      })
    }
    await copyFile(join(root, "render.json"), join(stage.directory, "render.json"))
    await copyTree(join(root, "variants"), join(stage.directory, "variants"))
    await publishRun(root, stage, { ...base, id, cards, legacyFingerprint: fingerprint }, render)
    return join(root, "reports", id)
  } catch (e) {
    if ((await scanLibrary(root)).runs.some((r) => r.id === id)) return join(root, "reports", id)
    throw e
  } finally {
    await rm(stage.directory, { recursive: true, force: true })
  }
}

/** Locate a canonical archive source, including a preserved root-level legacy profile. */
export const archivedSource = async (input: string): Promise<string | null> => {
  input = await realpath(input)
  let directory = dirname(input)
  for (;;) {
    if (RUN_ID.test(basename(directory)) && basename(dirname(directory)) === "reports")
      return join(directory, "profile.json")
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  if (basename(input) !== "profile.json") return null
  const root = dirname(input)
  const index = await scanLibrary(root)
  if (!index.runs.length) return null
  const fingerprint = createHash("sha256")
    .update(await readFile(input))
    .digest("hex")
  const run = index.runs.find((r) => r.legacyFingerprint === fingerprint)
  return run ? join(root, "reports", run.id, "profile.json") : null
}

export const protectsAnalysisDirectory = async (directory: string): Promise<boolean> => {
  try {
    directory = await realpath(directory)
  } catch (e) {
    if (missing(e)) return false
    throw e
  }
  return RUN_ID.test(basename(directory)) && basename(dirname(directory)) === "reports"
}
