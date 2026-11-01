import { describe, expect, it } from "vitest"
import { InstructionTracker } from "../../src/adapters/common/instruction-context.ts"

describe("instruction provenance", () => {
  it("links a user-selected skill to its recorded requirements", () => {
    const t = new InstructionTracker()
    t.user("u1", "Use $review for this change.")
    t.read("r1", "/work/.agents/skills/review/SKILL.md")
    t.result("r1", "Run tests before accepting changes.")
    expect(t.forPrompt("u1")[0]).toMatchObject({
      selection: "user_explicit",

      content: "Run tests before accepting changes.",
      contentStatus: "recorded",
    })
  })
  it("does not treat an assistant read as proof of user selection", () => {
    const t = new InstructionTracker()
    t.user("u1", "Fix the menu.")
    t.read("r1", "/work/.agents/skills/review/SKILL.md")
    t.result("r1", "Run tests.")
    expect(t.forPrompt("u1")[0]).toMatchObject({
      selection: "agent_selected",
    })
  })
  it("does not transfer user selection to a later turn", () => {
    const t = new InstructionTracker()
    t.user("u1", "Use $review, which I wrote.")
    t.read("r1", "/work/.agents/skills/review/SKILL.md")
    t.result("r1", "Check error handling.")
    expect(t.forPrompt("u1")[0]).toMatchObject({
      selection: "user_explicit",
      content: "Check error handling.",
    })
    t.user("u2", "Fix a different issue.")
    t.read("r2", "/work/.agents/skills/review/SKILL.md")
    expect(t.forPrompt("u2")[0]).toMatchObject({
      selection: "agent_selected",
      contentStatus: "missing",
      content: null,
    })
  })
  it("recognizes explicit file attachment, automatic rules and unavailable content separately", () => {
    const t = new InstructionTracker()
    t.automatic("/work/AGENTS.md", "Always ask before publishing.")
    t.user("u1", "Use [our rules](/work/CLAUDE.md).")
    t.read("r1", "/work/CLAUDE.md")
    t.result("r1", "Run typechecking.")
    const contexts = t.forPrompt("u1")
    expect(contexts.find((c) => c.name === "AGENTS.md")).toMatchObject({
      selection: "automatic",
    })
    expect(contexts.find((c) => c.name === "CLAUDE.md")).toMatchObject({
      selection: "user_explicit",
      content: "Run typechecking.",
    })
    t.user("u2", "Use $missing.")
    expect(t.forPrompt("u2")[0]).toMatchObject({ contentStatus: "missing" })
  })
  it("does not credit negated references or unrelated, failed and later reads", () => {
    const t = new InstructionTracker()
    t.user("u1", "Do not use $review.")
    t.read("r1", "/work/.agents/skills/review/SKILL.md")
    t.result("r1", "Error: file not found", true)
    expect(t.forPrompt("u1")[0]).toMatchObject({ selection: "agent_selected", content: null })
    t.read("other", "/work/source.ts")
    expect(t.forPrompt("u1")).toHaveLength(1)
    t.user("u2", "Next task.")
    t.result("r1", "Late result.")
    expect(t.forPrompt("u2")).toEqual([])
  })
})

it("reads Claude skill expansion without treating its instructions as another user prompt", () => {
  const t = new InstructionTracker()
  t.claude({
    type: "user",
    sessionId: "s",
    uuid: "u",
    message: { content: "<command-name>/review</command-name>" },
  })
  t.claude({
    type: "assistant",
    sessionId: "s",
    message: {
      content: [{ type: "tool_use", id: "c", name: "Skill", input: { skill: "review" } }],
    },
  })
  t.claude({
    type: "user",
    sessionId: "s",
    uuid: "injected",
    isMeta: true,
    message: {
      content:
        "Base directory for this skill: /work/.claude/skills/review\n\nTest changes before accepting them.",
    },
  })
  expect(t.forPrompt("claude-code:s:u")[0]).toMatchObject({
    selection: "user_explicit",
    contentStatus: "recorded",
  })
  expect(t.forPrompt("claude-code:s:injected")).toEqual([])
})

it("does not read mutable current files or infer content from a launch acknowledgement", () => {
  const t = new InstructionTracker()
  t.user("u", "Use $review.")
  t.claude({
    type: "assistant",
    sessionId: "s",
    message: {
      content: [{ type: "tool_use", id: "c", name: "Skill", input: { skill: "review" } }],
    },
  })
  t.claude({
    type: "user",
    sessionId: "s",
    message: {
      content: [{ type: "tool_result", tool_use_id: "c", content: "Launching skill: review" }],
    },
  })
  expect(t.forPrompt("u")[0]).toMatchObject({ content: null, contentStatus: "missing" })
})

it("keeps the first recorded version and does not reinterpret shell failure output as requirements", () => {
  const t = new InstructionTracker()
  t.user("u", "Use $review.")
  t.read("first", "/work/skills/review/SKILL.md")
  t.result("first", "Require tests.")
  t.read("later", "/work/skills/review/SKILL.md")
  t.result("later", "A modified version.")
  expect(t.forPrompt("u")[0]?.content).toBe("Require tests.")
  const other = new InstructionTracker()
  other.user("u", "Use $review.")
  other.codex(
    {
      type: "response_item",
      payload: {
        type: "function_call",
        call_id: "c",
        name: "exec_command",
        arguments: '{"cmd":"cat /work/skills/review/SKILL.md"}',
      },
    },
    "unused",
  )
  other.codex(
    {
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "c",
        output: "Process exited with code 1\nOutput:\ncat: No such file",
      },
    },
    "unused",
  )
  expect(other.forPrompt("u")[0]?.content).toBeNull()
})

it("uses explicit attachment metadata without crediting a skill listing as selection", () => {
  const t = new InstructionTracker()
  t.codex(
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Use the attached rules." },
          { type: "input_file", filename: "CLAUDE.md", text: "Require a rollback plan." },
        ],
      },
    },
    "u",
  )
  expect(t.forPrompt("u")[0]).toMatchObject({
    selection: "user_explicit",
    kind: "rules",
    content: "Require a rollback plan.",
  })
  t.codex(
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "developer",
        content: [
          { type: "input_text", text: "- review: offered skill (file: /skills/review/SKILL.md)" },
        ],
      },
    },
    "unused",
  )
  expect(t.forPrompt("u")).toHaveLength(1)
})

it("does not treat report links, delegated notifications or quoted URLs as user skill adoption", () => {
  const t = new InstructionTracker()
  t.user("u", "The report is [report](~/evidence/report.md).")
  expect(t.forPrompt("u")).toEqual([])
  t.user("v", "Delegated task node: completed. Use [report](~/evidence/report.md).")
  expect(t.forPrompt("v")).toEqual([])
  t.user("w", "[Assistant quote](t3-citation://example?text=Use+README.md)")
  expect(t.forPrompt("w")).toEqual([])
})

it("extracts one literal read from a recorded exec wrapper, never executing its code", () => {
  const t = new InstructionTracker()
  t.user("u", "Read .agents/skills/review/SKILL.md for this task.")
  t.codex(
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        name: "exec",
        call_id: "c",
        input:
          'text(await tools.exec_command({cmd:"cat .agents/skills/review/SKILL.md","max_output_tokens":20000}));',
      },
    },
    "unused",
  )
  t.codex(
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "c",
        output: [
          { type: "input_text", text: "Script completed\nOutput:\n" },
          {
            type: "input_text",
            text: JSON.stringify({ exit_code: 0, output: "Verify the accepted result." }),
          },
        ],
      },
    },
    "unused",
  )
  expect(t.forPrompt("u")[0]).toMatchObject({
    selection: "user_explicit",
    content: "Verify the accepted result.",
  })
})

it("aligns a literal batch of reads to ordered structured results without mixing files", () => {
  const t = new InstructionTracker()
  t.user("u", "Read .agents/skills/review/SKILL.md for this task.")
  t.codex(
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        name: "exec",
        call_id: "c",
        input:
          'text(await tools.exec_command({cmd:"cat .agents/skills/review/SKILL.md","max_output_tokens":20000}));\ntext(await tools.exec_command({cmd:"cat README.md CONTRIBUTING.md","max_output_tokens":20000}));',
      },
    },
    "unused",
  )
  t.codex(
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "c",
        output: [
          {
            type: "input_text",
            text: JSON.stringify({ exit_code: 0, output: "Require acceptance checks." }),
          },
          {
            type: "input_text",
            text: JSON.stringify({ exit_code: 0, output: "Unrelated documentation." }),
          },
        ],
      },
    },
    "unused",
  )
  expect(t.forPrompt("u")[0]?.content).toBe("Require acceptance checks.")
  expect(t.forPrompt("u")).toHaveLength(1)
})

it("does not interpret shell variables or a question about quoted rules as adoption", () => {
  const t = new InstructionTracker()
  t.user("u", "Read $HOME to understand where settings live.")
  expect(t.forPrompt("u")).toEqual([])
  t.user("v", "Follow [rules](AGENTS.md). 這句話好像不適合放在這裡，是不是已有文件？")
  expect(t.forPrompt("v").every((c) => c.selection !== "user_explicit")).toBe(true)
})

it("counts unsupported literal escapes without failing the source read", () => {
  const t = new InstructionTracker()
  t.user("u", "Use $review.")
  expect(() =>
    t.codex(
      {
        type: "response_item",
        payload: {
          type: "custom_tool_call",
          name: "exec",
          call_id: "c",
          input: 'text(await tools.exec_command({cmd:"cat /skills/review/SKILL.md\\q"}));',
        },
      },
      "unused",
    ),
  ).not.toThrow()
  expect(t.rejected).toBeGreaterThan(0)
  expect(t.forPrompt("u")[0]?.content).toBeNull()
})

it("does not turn a statement about a rules file into an explicit invocation", () => {
  const t = new InstructionTracker()
  t.automatic("AGENTS.md", "Require checks before publishing.")
  t.user("u", "I wrote AGENTS.md for this project. Please fix the menu.")
  expect(t.forPrompt("u")[0]).toMatchObject({ selection: "automatic" })
})

it("records documented purpose without collecting or interpreting authorship", () => {
  const t = new InstructionTracker()
  t.describe("review", "Review changes for correctness and acceptance checks.")
  t.user("u", "Use $review, which I wrote.")
  const context = t.forPrompt("u")[0]!
  expect(context).toMatchObject({
    description: "Review changes for correctness and acceptance checks.",
    content: null,
  })
  expect(context).not.toHaveProperty("authorship")
  expect(context).not.toHaveProperty("authorshipEvidence")
})

it("extracts a skill description from the recorded body rather than its filename", () => {
  const t = new InstructionTracker()
  t.user("u", "Use $helper.")
  t.read("c", "/skills/helper/SKILL.md")
  t.result(
    "c",
    "---\nname: helper\ndescription: Check a release against acceptance criteria.\n---\nRun the checks.",
  )
  expect(t.forPrompt("u")[0]?.description).toBe("Check a release against acceptance criteria.")
})
