/** The platform: the local machine (environment, private files, assets, the report library). */
export { Environment, EnvironmentLive } from "./Environment.ts"
export { FileError, writePrivateFile } from "./files.ts"
export { readAsset, registerAssets } from "./assets.ts"
export { resolveCacheDir } from "./paths.ts"
export { createExecution, listExecutions, saveExecution } from "./executions.ts"
export {
  archivedSource,
  createRunStage,
  discardRunStage,
  preserveLegacy,
  protectsAnalysisDirectory,
  publishRun,
  repairLibrary,
  scanLibrary,
} from "./library.ts"
