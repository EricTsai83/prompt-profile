# Changelog

## [1.0.0](https://github.com/EricTsai83/prompt-profile/compare/prompt-profile-v0.1.0...prompt-profile-v1.0.0) (2026-10-24)


### ⚠ BREAKING CHANGES

* **report:** share.html is no longer written (an old one is removed); use --exclude personal for what it showed.
* profile.json drops `language` (PROFILE_SCHEMA_VERSION 2; older files are rejected with a clear error) and the analysis cache is invalidated (ANALYSIS_VERSION 2).

### Features

* **adapters:** Claude Code adapter ([0bc6c0a](https://github.com/EricTsai83/prompt-profile/commit/0bc6c0a42ca4546bc4799c0df5ad1cb1cebf2296))
* **adapters:** Codex adapter and registry readAll ([2f4ccae](https://github.com/EricTsai83/prompt-profile/commit/2f4ccae32a8631744a8df2a7fc9a59f48e1b9a18))
* **adapters:** count Codex skills and models ([61eae3e](https://github.com/EricTsai83/prompt-profile/commit/61eae3e34a769dfff1cad3ee76ede3e99ec4d45d))
* **adapters:** look up skill descriptions in .agents/skills too ([3b7121d](https://github.com/EricTsai83/prompt-profile/commit/3b7121dec50d382be902e4f884856758f4f9c329))
* **adapters:** read skill descriptions from the transcripts' skill listings ([30ea351](https://github.com/EricTsai83/prompt-profile/commit/30ea3513ca3b124308851c05a8c49a921ac20c6c))
* add render-only report looks and share-card hiding ([2fb30a5](https://github.com/EricTsai83/prompt-profile/commit/2fb30a5843331cefa3bcb80c37d8d763c460cc8e))
* **analysis:** chunk → map → verify → reduce with cache ([2d8caab](https://github.com/EricTsai83/prompt-profile/commit/2d8caab250d5bba32ad8891395640f2e3fbd0d74))
* **analysis:** find verified ways to improve the user's prompts ([3cdee55](https://github.com/EricTsai83/prompt-profile/commit/3cdee553df1e191e524683bb67637c7257c3d0be))
* **analysis:** translate the profile into extra report languages ([cbef2a7](https://github.com/EricTsai83/prompt-profile/commit/cbef2a764f2cffc6c34b061d6942a901d889b7de))
* base workflow shares on sessions with transcripts; add the review page ([856db54](https://github.com/EricTsai83/prompt-profile/commit/856db54db266e849705190f587939e02cd504b93))
* **cli:** check the output for secrets and personal data before writing ([5188bac](https://github.com/EricTsai83/prompt-profile/commit/5188bac314d76726bd4ea7412c4684a2dee84375))
* **cli:** full prompt-profile command with stats, render and cache clear ([d9790f4](https://github.com/EricTsai83/prompt-profile/commit/d9790f414cf0d4a6f1751a56fb61b25ab6ed3fbb))
* **cli:** summarise what the report contains and how to share it safely ([6560334](https://github.com/EricTsai83/prompt-profile/commit/656033402002e992c3a9a9feb71bc008fdb21ce2))
* **domain:** add PromptRecord, Stats, Profile schemas and LLM JSON Schema subset ([6780de7](https://github.com/EricTsai83/prompt-profile/commit/6780de7e6e6fd3e0b3db130263948c4754836801))
* **llm:** LlmRunner with Claude Code and Codex runners ([aafa7bf](https://github.com/EricTsai83/prompt-profile/commit/aafa7bff2cf1be3a1704be7e26b310d9a80f1ad6))
* make the report and CLI English-only ([476e6aa](https://github.com/EricTsai83/prompt-profile/commit/476e6aabc545e8c3938ed931584c8b07588e0bc4))
* **pipeline:** exclude Codex acceptance runs started by a skill ([518277d](https://github.com/EricTsai83/prompt-profile/commit/518277d44f631bf5630788f3b378f29580186520))
* **pipeline:** exclude delegated sessions by opening hash ([deb24e4](https://github.com/EricTsai83/prompt-profile/commit/deb24e42daf8bfc3766f65e39c9d1b0e0e39f581))
* **pipeline:** filter, clean, redact and stats ([1f404ae](https://github.com/EricTsai83/prompt-profile/commit/1f404ae90df43d4bbdc34a24fa00fb5827ab91f9))
* **report:** add share.html for other people and a measured share card ([80755d3](https://github.com/EricTsai83/prompt-profile/commit/80755d31739cfbea0c23c945b3df04e905083bcc))
* **report:** compare with the previous report ([8f366c5](https://github.com/EricTsai83/prompt-profile/commit/8f366c5b8bd722b88178fa1d66b30fe48de7d7e3))
* **report:** lead with identity, signature traits and measured habits ([5880ff1](https://github.com/EricTsai83/prompt-profile/commit/5880ff1ea243e7ad243534d29bf0701443cb7158))
* **report:** map AI capability by stage with named skills and tools ([ccadf91](https://github.com/EricTsai83/prompt-profile/commit/ccadf914230bb8709fb61bc0984278d4cde3fa8b))
* **report:** one report with --exclude parts instead of a share page ([3884867](https://github.com/EricTsai83/prompt-profile/commit/3884867e7f05c29fb78434df17d58f2a03180eb7))
* **report:** redesign the report with charts and a language switch ([46815a1](https://github.com/EricTsai83/prompt-profile/commit/46815a1305542e89da80b807c660dbdf2c1db826))
* **report:** self-contained HTML report and PNG share card ([809a288](https://github.com/EricTsai83/prompt-profile/commit/809a288fb5d1f0a489123f5368b55783a156e562))
* **report:** show activity by day and project with hover details ([0df1e7a](https://github.com/EricTsai83/prompt-profile/commit/0df1e7a2ffaa2a3a313949f285288ac1ec12efb4))
* **report:** show how I work with AI, in four layouts for review ([0ed1b5d](https://github.com/EricTsai83/prompt-profile/commit/0ed1b5d3d6bd00d90712add88ea5c06e7c7b658d))
* **report:** show how to improve your prompts ([ab368d7](https://github.com/EricTsai83/prompt-profile/commit/ab368d745849f1574d575f4182175f4749f1900a))
* **report:** show the data period and generation time in the header ([170c216](https://github.com/EricTsai83/prompt-profile/commit/170c2161ba7c55db4a8db4bffe5f926b33ce16be))
* **stats:** measure AI workflow and prompt-writing techniques ([7973683](https://github.com/EricTsai83/prompt-profile/commit/7973683cda61e3a41bcd168b11201c4ed0a2fcd5))


### Bug Fixes

* **adapters:** count unreadable files; number JSONL lines per run ([39de2a5](https://github.com/EricTsai83/prompt-profile/commit/39de2a5acfe0cd3b0dc64814811edfa559157586))
* **adapters:** de-duplicate Codex messages across rollout files ([f85030a](https://github.com/EricTsai83/prompt-profile/commit/f85030acc5b82fada0141b981a91a80fc8a076ab))
* **adapters:** ignore slash commands of command-only Claude sessions ([4ed0a6f](https://github.com/EricTsai83/prompt-profile/commit/4ed0a6f398d5d1d62e39f59c4f0adbee0ecd11a7))
* **adapters:** make findFiles loop-safe and stat entries concurrently ([82c7b9c](https://github.com/EricTsai83/prompt-profile/commit/82c7b9c9e1af7dffd9f8ae6e7dc17f0a4ad4d947))
* **adapters:** skip Claude history for sessions resumed into another transcript ([7eae0dd](https://github.com/EricTsai83/prompt-profile/commit/7eae0dd11ccc6d7cedbfa33c8b4bd51e96fd0f17))
* **analysis:** cache clear keeps the downloaded fonts ([958def2](https://github.com/EricTsai83/prompt-profile/commit/958def25e75d52172c2e64a9b228eae4070db593))
* **analysis:** cap evidence per observation so merges converge ([f40eeba](https://github.com/EricTsai83/prompt-profile/commit/f40eeba3f378cb0a41cb9ecbb736fe589288b64a))
* **analysis:** cap trait confidence by how widely its quotes spread ([0bab0ad](https://github.com/EricTsai83/prompt-profile/commit/0bab0ad8d5347e1ced10db2270b2327393c77959))
* **analysis:** label weekday stats by name for the reduce step ([7a6c2f5](https://github.com/EricTsai83/prompt-profile/commit/7a6c2f5555df1e14220b41aa9503600d16b78457))
* **analysis:** store evidence quotes as they appear in the prompt ([58db59c](https://github.com/EricTsai83/prompt-profile/commit/58db59c2057ddfd186e81de403fcb09626e21349))
* **analysis:** tell the reduce step not to over-generalise ([8ee0099](https://github.com/EricTsai83/prompt-profile/commit/8ee00990069e264bec32b47f522393f1d1a3d7ba))
* **analysis:** verify cached merge results and keep fatal merge errors ([e20e7c0](https://github.com/EricTsai83/prompt-profile/commit/e20e7c035d7df0a3c86e8ef4a782eb1e13ff8135))
* **cli:** --dry-run estimates with the engine a real run would use ([5b21613](https://github.com/EricTsai83/prompt-profile/commit/5b216135d390637a085472aff39eefc28d192d3f))
* **cli:** --verbose shows the underlying cause of an error ([94d2910](https://github.com/EricTsai83/prompt-profile/commit/94d2910487c0b5e8bf467d34d2b908f31a5e9388))
* **cli:** describe --lang per command; render messages follow --lang ([3f9eaa4](https://github.com/EricTsai83/prompt-profile/commit/3f9eaa47a02d32bcb030765920ae90d3a2b4f575))
* **cli:** localise the stats summary; one peakHour for report and CLI ([3c439a3](https://github.com/EricTsai83/prompt-profile/commit/3c439a399353c3dcd4e58f360e69ed0954fd6fc2))
* **cli:** show bugs as a short message; stack only with --verbose ([9dc89de](https://github.com/EricTsai83/prompt-profile/commit/9dc89ded87bf882312e61342b7bedf419a2b3c3c))
* **cli:** treat --since ranges before 1970 as all instead of crashing ([b34ed8d](https://github.com/EricTsai83/prompt-profile/commit/b34ed8d8e9ec89473ca03c3297fb91dad24aee41))
* **domain:** reject invalid time zones when decoding stats ([3d4bb6f](https://github.com/EricTsai83/prompt-profile/commit/3d4bb6ff1be90402b73d9dcf316fd941e1872878))
* enforce analysis limits and reliable output cleanup ([60e68cc](https://github.com/EricTsai83/prompt-profile/commit/60e68cc2ba63c6ea351ff1221013cc6a106c5b80))
* **llm:** a slow CLI is not "not installed"; detect Codex login on stderr ([0ef51f0](https://github.com/EricTsai83/prompt-profile/commit/0ef51f0b6223d66ea63edae7634cce21a183e8c8))
* **llm:** isolate user customizations during analysis ([afd28b0](https://github.com/EricTsai83/prompt-profile/commit/afd28b0f9eafa76f67e1b3eb2afef8c8511e149c))
* **pipeline:** count project-name redactions in the report ([e38dc76](https://github.com/EricTsai83/prompt-profile/commit/e38dc76c5d836138f36b3b570845faaa019fae07))
* **pipeline:** do not redact generic account names as the username ([200f7b5](https://github.com/EricTsai83/prompt-profile/commit/200f7b541d0550ccb9f9fc3032d071e4c032e160))
* **pipeline:** redact before truncating long prompts ([1a3d457](https://github.com/EricTsai83/prompt-profile/commit/1a3d4570a15788d73a30348933d17528f65fefd0))
* **platform:** accept POSIX TZ values instead of crashing ([70958aa](https://github.com/EricTsai83/prompt-profile/commit/70958aad4647540e2f5298b1fd6fd823ffab7a1a))
* **platform:** never chmod existing folders; clean up failed temp files ([458c387](https://github.com/EricTsai83/prompt-profile/commit/458c387cb90309a704453701ce05c26a0d55dafb))
* **report,cli:** width-aware card text clipping; pluralise call count ([4faf43b](https://github.com/EricTsai83/prompt-profile/commit/4faf43bae2cf9d2a9ad22dc5423bc9f54cc6002a))
* **report:** cut card text at a word boundary ([a748750](https://github.com/EricTsai83/prompt-profile/commit/a748750e2432aa151b3a795880688ec72b4c4cdb))
* **report:** hide project names in quotes and dates in generation time; keep masked quotes valid ([5d6fccc](https://github.com/EricTsai83/prompt-profile/commit/5d6fccc4abf39a33c0ad5d0fd1eedb92677b8629))
* **report:** name the client mix by client and mute "other folders" ([e819d8a](https://github.com/EricTsai83/prompt-profile/commit/e819d8a7f97ee2a221c8715ae213afb65c5da3da))


### Performance Improvements

* **adapters:** read sources concurrently via registry.readSources ([ba7ee3e](https://github.com/EricTsai83/prompt-profile/commit/ba7ee3ecf7b75b1eb7a20daad746c0d034f48f67))
* **adapters:** reduce lines to prompts while streaming (halves peak memory) ([4d28ade](https://github.com/EricTsai83/prompt-profile/commit/4d28aded2fbadeb4c2501cb3ffbd41a7c1d68f27))
* **report:** download the CJK fonts concurrently, abort on failure ([3b15f3b](https://github.com/EricTsai83/prompt-profile/commit/3b15f3bf0965d07145808ba3d59401d8536ad42d))
