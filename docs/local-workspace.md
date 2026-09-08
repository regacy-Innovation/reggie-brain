# Reggie local workspace

## Root layout

Reggie keeps its operating files under one local workspace root. The recommended root is `C:\Reggie`.

```text
C:\Reggie\
  brain\                 # Clone of the Reggie brain repository
    daily-reports\        # Versioned daily report snapshots
    ideas\                # Versioned idea records and their status
  projects\              # Clean registered base clones; never edit directly
  worktrees\             # One isolated Git worktree for each active mission
  state\                 # Durable runner state and mission database
  missions\              # Per-mission evidence, result, and non-secret logs
  artifacts\             # Mission outputs that are not source code
  scratch\               # Re-creatable temporary files; never authoritative
```

The runner configuration declares the actual root paths. Do not assume that an
existing developer checkout is Reggie's managed workspace unless it is present
in `config/projects.yml`.

## Brain and instructions

`C:\Reggie\brain` is the only local copy of the versioned Reggie brain
repository. Before each mission, fetch and fast-forward this repository, then
record its commit SHA in the mission record.

The brain repository contains the versioned instructions, daily reports, and
ideas. Do not create an independent `instructions` folder, copy instructions
into a mission folder, or edit local instruction snapshots. Read the versioned
brain repository directly so the recorded SHA identifies the exact instruction
set.

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

`missions\YYYY\MM\DD\<mission-id>\` contains a readable, non-secret evidence
bundle for that mission:

```text
missions\YYYY\MM\DD\<mission-id>\
  request.md              # Original request and Slack message identity
  context.json            # Brain SHA, project IDs, starting revisions, branches
  result.md               # Terminal result, evidence, Git and deployment references
  changed-files.txt       # Changed paths only
  logs\                   # Non-secret runner and agent logs
  artifacts\              # Pointers or copied non-secret mission artifacts
```

Do not store credentials, API tokens, complete database exports, unrelated
customer data, or duplicate project source files in a mission bundle.

## Daily reports

At the daily-summary boundary, write one immutable report snapshot in the brain
repository at:

```text
brain\daily-reports\YYYY\MM\YYYY-MM-DD.md
```

The date uses Asia/Tokyo. The report covers the preceding 24 hours and is
derived from persisted mission records, not agent memory. It contains each
mission ID, request summary, terminal status, result or blocker, Reggie brain
SHA, project reference, Git or deployment reference, and required owner action.

Use the same report content for the Slack daily summary. Post it only to
`#dev_system-development-team` (`C074BCJGQGP`). Do not create a report when
there was no mission activity.

Before posting the Slack summary, commit and push the new daily report to the
Reggie brain repository. Record the report Git commit SHA in the Slack message
and in the runner state. The report is the durable reviewable record even if
Slack delivery fails.

## Ideas

An idea is not a mission and must not trigger code changes or deployment.

Store a new idea in `brain\ideas\inbox\<idea-id>.md` only when the user
explicitly asks Reggie to capture it. Each file includes the idea ID, capture
time, source Slack message identity, summary, target project when known, and
open questions. Commit and push the capture record to the Reggie brain
repository.

When the owner accepts an idea as work, move its file to
`brain\ideas\accepted\` and record the linked mission ID. When it is rejected,
completed, or replaced, move it to `brain\ideas\archived\` with the outcome and
any successor idea or mission ID. Commit and push each status change.

Do not silently convert an idea into a mission or silently delete an idea.

## Artifacts and scratch files

Store generated non-code artifacts under `artifacts\YYYY\MM\<mission-id>\` and
reference their paths in the mission record. Keep large reproducible outputs in
their owning project or approved artifact store when that repository requires it.

`scratch\` is only for re-creatable temporary work. Never place the sole copy
of instructions, a mission record, a report, an idea, source code, or an
artifact there.

## Secrets and personal notes

Keep Slack credentials, GitHub credentials, API keys, and deployment secrets
outside `C:\Reggie` in the operating system credential store or service-manager
secret configuration. Never commit or log them.

Store personal working notes in the Obsidian vault, not in Reggie's mission,
report, idea, or project folders.
