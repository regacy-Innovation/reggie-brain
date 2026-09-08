# Mission lifecycle contract

## Authoritative inputs

| Input | Authority | Required meaning |
| --- | --- | --- |
| Slack request | Slack event stored by the runner | Original request, sender, channel or DM, message timestamp, and thread timestamp |
| Brain revision | Reggie brain Git commit | Exact instructions used for this mission |
| Target project | `config/projects.yml` | Registered local path, origin URL, and upstream branch |
| Project revision | Target worktree Git commit | Code revision inspected by the agent |

## Agent input manifest

The agent receives only the original request, selected project registration, brain instructions, relevant project instructions, and files explicitly read from the selected worktree. It must not receive whole database records, unrelated repository contents, secrets, or other mission transcripts.

## Persisted outputs

The runner must persist one mission record containing the mission ID and Slack message/thread identities; Reggie brain commit SHA; target project ID, local-path identity, origin URL, starting revision, permitted development push branch, and deployment environment; worktree path and branch name; terminal status (`succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`); final result, changed files, Git commit, pull request, deployment reference, blocker, and completion timestamp as applicable; plus completion-DM delivery state and daily-summary inclusion state.

## Downstream requirements

The completion Slack DM and the daily summary are generated from these persisted records. A terminal agent response without a persisted terminal record does not count as a completed mission.
