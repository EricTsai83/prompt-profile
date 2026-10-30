import { Effect, Schema } from "effect"
import { expect, it } from "vitest"
import { makeLlmSchema } from "../../src/llm/LlmRunner.ts"

it("requires defaulted fields in the model schema while accepting missing fields on decode", () => {
  const codec = Schema.Struct({
    observations: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed([])),
    ),
  })
  const model = makeLlmSchema("Compatible", codec)
  expect(model.jsonSchema.required).toEqual(["observations"])
  expect(Schema.decodeUnknownSync(model.schema)({})).toEqual({ observations: [] })
})
