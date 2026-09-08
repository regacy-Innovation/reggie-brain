# Mission lifecycle contract

## Authoritative inputs

| Input | Authority | Required meaning |
| --- | --- | --- |
| Slack request | Newly delivered Slack message event stored by the runner | Original request, sender, channel, message timestamp, thread timestamp, original message language, and the matched configured member mention |
| Slack trigger configuration | Runner local configuration | Permitted channel ID and the Slack member ID whose mention triggers a mission |
| Brain revision | Reggie brain Git commit | Exact instructions used for this mission |
| Target project | `config/projects.yml` | Registered local path, origin URL, and upstream branch |
| Project revision | Target worktree Git commit | Code revision inspected by the agent |

## Agent input manifest

The agent receives only the original request, the instruction to reply in the original message language, selected project registration, brain instructions, relevant project instructions, and files explicitly read from the selected worktree. It must not receive whole database records, unrelated repository contents, secrets, or other mission transcripts.

## Persisted outputs

The runner must persist one mission record containing the mission ID; Slack message/thread identities; matched configured member mention; Reggie brain commit SHA; target project ID, local-path identity, origin URL, starting revision, permitted development push branch, and deployment environment; worktree path and branch name; terminal status (`succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`); final result, changed files, Git commit, pull request, deployment reference, blocker, and completion timestamp as applicable; plus delivery state for the permitted Slack channel and daily-summary inclusion state.

## Downstream requirements

The completion Slack message replies in the triggering message's thread and uses the original message language. The daily summary is sent only to the permitted Slack channel. Both are generated from persisted mission records. A terminal agent response without a persisted terminal record does not count as a completed mission.
