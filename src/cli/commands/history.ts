import { Effect, Path } from "effect"
import { repairLibrary } from "../../platform/library.ts"
import { renderLibrary } from "../../report/library.ts"
import { libraryIo } from "../library.ts"
import { resolveOut } from "../steps.ts"
import { Output } from "../services.ts"
import { messages } from "../messages.ts"

export const runHistory = (out: string) =>
  Effect.gen(function* () {
    const root = yield* resolveOut(out)
    const index = yield* libraryIo(root, () => repairLibrary(root, renderLibrary))
    const path = yield* Path.Path
    yield* (yield* Output).line(
      messages.historyRepaired(index.runs.length, index.skipped, path.join(root, "index.html")),
    )
  })
