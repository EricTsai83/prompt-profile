import { Schema } from "effect"

/** Recorded instruction purpose, selection and historical requirements. */
export const InstructionContext = Schema.Struct({
  id: Schema.String,
  parentPromptId: Schema.String,
  name: Schema.String,
  description: Schema.optionalKey(Schema.NullOr(Schema.String)),
  kind: Schema.Literals(["skill", "rules", "reference"]),
  selection: Schema.Literals(["user_explicit", "agent_selected", "automatic", "unknown"]),
  selectionEvidence: Schema.NullOr(Schema.String),
  content: Schema.NullOr(Schema.String),
  contentStatus: Schema.Literals(["recorded", "truncated", "missing"]),
})
export type InstructionContext = typeof InstructionContext.Type

/** Only explicitly adopted, historically recorded content can support user-choice claims. */
export const instructionEvidence = (p: {
  readonly id: string
  readonly text: string
  readonly instructionContexts?: ReadonlyArray<InstructionContext>
}): ReadonlyArray<readonly [string, string]> => [
  [p.id, p.text],
  ...(p.instructionContexts ?? []).flatMap((c) =>
    c.selection === "user_explicit" && c.content !== null ? [[c.id, c.content] as const] : [],
  ),
]
