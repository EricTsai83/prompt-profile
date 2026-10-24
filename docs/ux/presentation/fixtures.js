// Synthetic profiles for the presentation experiment (plan 11, stage 2).
// Fictional data only, in the Profile schemaVersion 2 field layout. `stats` keeps only the
// fields this prototype reads. Chinese quotes are test input built like real CJK prompts.
window.PRESENTATION_FIXTURES = {
  sample: {
    schemaVersion: 2,
    generatedAt: "2026-10-24T02:00:00.000Z",
    engine: { runner: "claude-code", model: "claude-opus-5-5", analysisVersion: "1" },
    coverage: {
      chunksTotal: 22,
      chunksAnalyzed: 18,
      chunksFromCache: 3,
      chunksFailed: 1,
      sampled: false,
      sessionsAnalyzed: 280,
      promptsAnalyzed: 1290,
      evidenceKept: 41,
      evidenceDropped: 3,
    },
    headline: "Plans in daylight, refactors after midnight",
    archetype: {
      name: "The Midnight Architect",
      description: "Ships features by day, refactors by night.",
    },
    dimensions: [
      {
        key: "work_style",
        title: "Work style",
        summary:
          "Asks for a plan and its risks before any code, then works through it in small, checked steps.",
        evidence: [
          {
            promptId: "claude-code:s0:u0",
            quote: "don't write code yet, break the plan into small steps",
          },
          {
            promptId: "claude-code:s7:u2",
            quote: "list the risks first, then we pick the smallest safe change",
          },
        ],
      },
      {
        key: "communication",
        title: "Communication",
        summary: "Short, direct instructions; corrects course quickly when an answer drifts.",
        evidence: [
          { promptId: "claude-code:s1:u1", quote: "no, keep the old API and only rename the flag" },
        ],
      },
      {
        key: "tech_profile",
        title: "Tech profile",
        summary: "TypeScript-first, with strict types, schema validation and command-line tooling.",
        evidence: [
          { promptId: "codex:s2:3", quote: "make the schema strict and reject unknown fields" },
        ],
      },
      {
        key: "interests",
        title: "Interests",
        summary: "Developer tools, privacy-preserving data handling and clear naming.",
        evidence: [
          {
            promptId: "claude-code:s3:u3",
            quote: "what would be a less vague name for this module?",
          },
        ],
      },
      {
        key: "growth",
        title: "Growth",
        summary: "No clear change over time is supported by this sample.",
        evidence: [],
      },
    ],
    traits: [
      {
        name: "Plan first",
        description: "Asks the AI to list steps and risks before coding.",
        confidence: "high",
        evidence: [
          {
            promptId: "claude-code:s0:u0",
            quote: "don't write code yet, break the plan into small steps",
          },
          { promptId: "codex:s4:1", quote: "先列出步驟和風險，再開始改程式" },
        ],
      },
      {
        name: "Straight talker",
        description: "Gives short corrections instead of long explanations.",
        confidence: "medium",
        evidence: [
          { promptId: "claude-code:s1:u1", quote: "no, keep the old API and only rename the flag" },
        ],
      },
      {
        name: "Type purist",
        description: "Prefers failing early on unexpected data.",
        confidence: "low",
        evidence: [
          { promptId: "codex:s2:3", quote: "make the schema strict and reject unknown fields" },
        ],
      },
    ],
    funFacts: ["Latest prompt: 03:12 AM.", "Longest streak: 23 days in a row."],
    stats: {
      totalPrompts: 1980,
      totalSessions: 312,
      activeDays: 141,
      longestStreakDays: 23,
      latestTime: "03:12",
      topProjects: [
        { name: "drawstuff", count: 420 },
        { name: "prompt-profile", count: 210 },
      ],
      hourHistogram: [
        40, 22, 9, 3, 0, 0, 1, 4, 20, 61, 98, 120, 80, 110, 140, 150, 135, 118, 90, 100, 130, 160,
        170, 120,
      ],
    },
  },
  edge: {
    schemaVersion: 2,
    generatedAt: "2026-10-24T02:00:00.000Z",
    engine: { runner: "codex", model: null, analysisVersion: "1" },
    coverage: {
      chunksTotal: 260,
      chunksAnalyzed: 30,
      chunksFromCache: 0,
      chunksFailed: 4,
      sampled: true,
      sessionsAnalyzed: 2400,
      promptsAnalyzed: 18000,
      evidenceKept: 12,
      evidenceDropped: 19,
    },
    headline:
      "A remarkably persistent operator who keeps rewriting the same deployment checklist until every step is boring",
    archetype: {
      name: "The Extraordinarily Deliberate Infrastructure Cartographer",
      description:
        "Maps every dependency twice before touching production, then writes it all down for whoever comes next.",
    },
    dimensions: [
      {
        key: "work_style",
        title: "Work style",
        summary:
          "Documents the system before changing it and keeps checklists for repeated operations.",
        evidence: [
          {
            promptId: "codex:s10:2",
            quote: "部署前先幫我把所有相依服務畫成一張表，包含負責人和回滾方式",
          },
        ],
      },
      {
        key: "communication",
        title: "Communication",
        summary: "Mixes Chinese and English within one request.",
        evidence: [
          {
            promptId: "codex:s11:4",
            quote: "這個 migration 的 rollback 步驟 should be idempotent，請確認",
          },
        ],
      },
      {
        key: "tech_profile",
        title: "Tech profile",
        summary: "Infrastructure, deployment pipelines and database migrations.",
        evidence: [],
      },
      {
        key: "interests",
        title: "Interests",
        summary: "Reliability and operational documentation.",
        evidence: [],
      },
      {
        key: "growth",
        title: "Growth",
        summary: "No clear change over time is supported by this sample.",
        evidence: [],
      },
    ],
    traits: [
      {
        name: "Extremely thorough pre-deployment dependency mapper",
        description: "Lists dependencies, owners and rollback steps before a release.",
        confidence: "medium",
        evidence: [
          {
            promptId: "codex:s10:2",
            quote: "部署前先幫我把所有相依服務畫成一張表，包含負責人和回滾方式",
          },
        ],
      },
      {
        name: "Bilingual",
        description: "Switches language mid-sentence.",
        confidence: "low",
        evidence: [
          {
            promptId: "codex:s11:4",
            quote: "這個 migration 的 rollback 步驟 should be idempotent，請確認",
          },
        ],
      },
      {
        name: "Checklist keeper",
        description: "Turns repeated work into written steps.",
        confidence: "low",
        evidence: [],
      },
    ],
    funFacts: ["Latest prompt: 04:58 AM."],
    stats: {
      totalPrompts: 1234567,
      totalSessions: 98765,
      activeDays: 1460,
      longestStreakDays: 365,
      latestTime: "04:58",
      topProjects: [{ name: "infra-control-plane-migration-2026", count: 90210 }],
      hourHistogram: [
        900, 700, 520, 400, 380, 300, 120, 80, 3000, 9000, 12000, 15000, 9000, 14000, 18000, 21000,
        19000, 17000, 9000, 6000, 4000, 3000, 2000, 1500,
      ],
    },
  },
}
