import { listExecutions } from "../../platform/executions.ts"
import { Effect, Path } from "effect"
import { repairLibrary } from "../../platform/library.ts"
import { renderLibrary } from "../../report/library.ts"
import { libraryIo } from "../library.ts"
import { resolveOut } from "../steps.ts"
import { Output } from "../services.ts"
import { messages } from "../messages.ts"

export const runHistory = (out: string, executions = false) =>
  Effect.gen(function* () {
    const root = yield* resolveOut(out)
    if (executions) {
      const result = yield* libraryIo(root, () => listExecutions(root))
      const output = yield* Output
      const path = yield* Path.Path
      yield* output.line(messages.executionsListed(result.skipped))
      for (const record of result.records)
        yield* output.line(
          messages.executionHistory(
            record.id,
            record.outcome,
            path.join(root, "executions", record.id, "summary.json"),
          ),
        )
      return
    }
    const index = yield* libraryIo(root, () => repairLibrary(root, renderLibrary))
    const path = yield* Path.Path
    yield* (yield* Output).line(
      messages.historyRepaired(index.runs.length, index.skipped, path.join(root, "index.html")),
    )
  })
