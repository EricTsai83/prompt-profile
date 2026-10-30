# Local report library

Every successful analysis publishes a new immutable report directory beneath the requested
output root. Reusing cached analysis chunks still creates a distinct report. Completed reports
are retained indefinitely; there is no automatic cleanup or retention policy.

```text
prompt-profile-report/
  index.html
  library.json
  reports/
    timestamp-and-unique-id/
      run.json
      profile.json
      report.html
      card.png
      card.en.png
      variants/
        signal/
          report.html
          profile.json
          render.json
          card.png
```

The CLI prints the report, profile and library paths. Open `index.html` for the bilingual,
offline history page. It links to the latest completed report and lists each run's date,
source window, sampling, languages, engine and complete role when supported. Unknown or mixed
preferences do not acquire a role merely to fill the index. Dates honor each run's exclusion
settings. Card failures are recorded and do not prevent publishing profile JSON and HTML.

## Rendering and recovery

Use the profile path printed by the CLI:

```bash
prompt-profile render path/to/profile.json --look signal
prompt-profile render path/to/profile.json
prompt-profile render path/to/profile.json --out separate-output
prompt-profile history --out prompt-profile-report
```

For archived profiles, render outputs go beneath that run's `variants/` folder, including
`variants/classic/` for a default render. They never overwrite the archived analysis or move
the latest-analysis pointer. Explicit external output remains available. Standalone profiles
outside a library retain their existing render behavior. Symlink aliases cannot bypass the
archive overwrite protection. The final output check still runs before new files are written.

`history` rebuilds `library.json` and `index.html` without an LLM call, reading completion
manifests rather than executing report HTML. Use it after a lost/corrupt index or an interrupted
index publication. Invalid, unsupported or symlink entries are skipped and counted; supplied
manifest paths cannot point to arbitrary files. Relative links work from `file://`, without
network assets or required JavaScript. New archived reports and their variants link back to
the library.

## Publication and older output

A run is written into a private pending directory. Only after profile and HTML exist is its
completion manifest written and the directory atomically renamed into the completed namespace.
Pending directories never become latest. Concurrent successful writers rebuild and rescan
until their index contains the union of completed runs; the completion manifests remain the
source of truth. A crash may leave a stale index, which `history` repairs. A failed index write
cannot remove an already completed report. Interrupted pending folders are left private and
ignored, rather than treated as successful analysis.

Readable legacy root-level profiles and their HTML, cards and variants are preserved under a
stable legacy ID before the first upgraded analysis publishes. Their root-level originals are
not removed or modified. A missing legacy HTML report can be reconstructed locally; no model
call is required. Unreadable legacy originals remain untouched. Legacy dates are shown at
month precision in the new index when their original render exclusions are unknown.

Folders created by the tool are private (0700), and files are private (0600) and written through
a unique temporary file then renamed. Existing folders keep their permissions. The library,
profiles, completion manifests and renders can contain personal information and stay local;
this is not an upload or sharing feature.
