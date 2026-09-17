# Reggie local workspace

## Root layout

Reggie keeps its operating files under one local workspace root. `C:\Reggie` is a Windows example, not a required location. Configure the actual paths locally; for example, a Mac may use `/Users/<user>/Reggie`.

```text
<REGGIE_HOME>\
  brain\                 # Clone of the Reggie brain repository
    daily-reports\        # Historical GitHub reports; no new daily knowledge
    weekly-reports\       # Historical GitHub reports; no new daily knowledge
    monthly-reports\      # Historical GitHub reports; no new daily knowledge
    ideas\                # Historical GitHub idea records; no new captures
    missions\             # Versioned lightweight mission records
  projects\              # Clean registered base clones; never edit directly
  worktrees\             # One isolated Git worktree for each active mission
  state\                 # Durable runner state and mission database
  artifacts\             # Local binary and large mission outputs
  scratch\               # Re-creatable temporary files; never authoritative
```

The runner configuration declares the actual root paths. A registered project's
per-computer clone location may be overridden in ignored
`config/projects.local.yml`. Do not assume that an existing developer checkout
is Reggie's managed workspace unless it is registered in `config/projects.yml`
and its local clone origin has been verified.

## Brain and instructions

`C:\Reggie\brain` is the only local copy of the versioned Reggie brain
repository. Before each mission, fetch and fast-forward this repository, then
record its commit SHA in the mission record.

The brain repository contains the versioned core direction and required mission
evidence. Do not create an independent `instructions` folder, copy instructions
into a mission folder, or edit local instruction snapshots. Read the versioned
brain repository directly so the recorded SHA identifies the exact instruction
set. Do not add daily knowledge, thoughts, memos, reflections, ideas, or
improvement notes to this repository; store them in Linear documents.

## Project clones and worktrees

`projects\<project-id>` holds one clean base clone for every project registered
in `config/projects.yml`. The runner fetches it before creating a mission.

`worktrees\<mission-id>\<project-id>` holds the mission-specific Git worktree
and branch. All source changes occur there. Do not modify the base clone.

Keep one worktree per active mission and project. A multi-project mission uses
separate worktrees, one for each registered project. Preserve the base clone
and worktree until the mission reaches a terminal state and its required
evidence has been persisted.

## Mission records

`state\` is the durable source for runner state. The mission database records
the fields defined by `contracts/mission-lifecycle.md`.

`brain\missions\YYYY\MM\DD\<mission-id>\` contains the versioned, readable,
non-secret evidence bundle for that mission:

```text
missions\YYYY\MM\DD\<mission-id>\
  request.md              # Original request and Slack message identity
  context.json            # Brain SHA, project IDs, starting revisions, branches
  result.md               # Terminal result, evidence, Git and deployment references
  updates.md              # Acknowledgements, progress messages, and plan changes
  changed-files.txt       # Changed paths only
  artifacts.md            # References to local binary artifacts and checksums
```

Commit and push the terminal mission bundle to the Reggie brain repository. Do
not store credentials, API tokens, complete database exports, unrelated customer
data, duplicate project source files, raw logs, or binary artifacts in it.

## Daily knowledge, retrospectives, and ideas

At the 09:00 UTC daily-review boundary (18:00 Asia/Tokyo), capture daily
knowledge and retrospective learning in the designated Linear document. Keep
daily entries dated in Asia/Tokyo and cite their mission IDs, GitHub commits,
and evidence links. Use the same Linear knowledge space for weekly or monthly
rollups, thoughts, memos, ideas, and improvement proposals; update the relevant
existing document where one exists.

An idea or improvement recorded in Linear is not a mission and must not trigger
code changes, deployment, or a core-direction change. A core change remains
subject to review, validation, and a committed-and-pushed GitHub update.

## Artifacts and scratch files

Store generated binary or large artifacts under
`artifacts\YYYY\MM\<mission-id>\`. This includes PowerPoint decks, PDFs,
images, videos, archives, large spreadsheets, and other generated binary files.

For every local artifact, write a versioned reference in the mission bundle with
its mission ID, filename, local path, content type, creation time, and checksum.
Keep reproducible outputs in their owning project or approved artifact store
when that repository requires it.

For a web-system bug fix, store the browser recordings as separate `before` and
`after` video artifacts. Attach both videos to the pull request, then record
their pull-request attachment references with the artifact metadata in the
mission bundle.

`scratch\` is only for re-creatable temporary work. Never place the sole copy
of instructions, a mission record, a report, an idea, source code, or an
artifact reference there.

## Secrets and personal notes

Keep Slack credentials, GitHub credentials, API keys, and deployment secrets
outside `C:\Reggie` in the operating system credential store or service-manager
secret configuration. Never commit or log them.

Store personal working notes, gathered knowledge, thoughts, memos, ideas, and
improvement proposals in Linear documents, not in Reggie's mission, report,
idea, project, or local-note folders.
