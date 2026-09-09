# Mission lifecycle contract

## Authoritative inputs

| Input | Authority | Required meaning |
| --- | --- | --- |
| Slack request | Newly polled Slack message stored by the agent | Original request, sender, channel, message timestamp, thread timestamp, original message language, matched member mention, and attached Slack file IDs, names, and MIME types |
| Slack trigger configuration | Local agent configuration | Permitted channel IDs, the member ID for `@tomoya imai`, and the persisted polling cursor |
| Brain revision | Reggie brain Git commit | Exact instructions used for this mission |
| Role selection | `REGGIE_ROLE` validated against `config/roles.yml` | Role ID and Git-versioned role instruction path used for this mission |
| Target project | `config/projects.yml` | Registered local path, origin URL, and upstream branch |
| Project revision | Target worktree Git commit | Code revision inspected by the agent |

## Agent input manifest

The agent receives only the original request, the instruction to reply in the original message language, shared brain instructions, the selected role instructions, selected project registration when applicable, relevant project instructions, explicitly downloaded Slack artifact paths, extracted-text paths when available, and files explicitly read from the selected worktree. It must not receive whole database records, unrelated repository contents, secrets, or other mission transcripts.

## Persisted outputs

The runner must persist one mission record containing the mission ID; Slack message/thread identities; matched configured member mention; Reggie brain commit SHA; role ID and role instruction path; target project ID, local-path identity, origin URL, starting revision, permitted development push branch, and deployment environment when applicable; worktree path and branch name when applicable; terminal status (`succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`); final result, changed files, Git commit, pull request, deployment reference, blocker, and completion timestamp as applicable; plus delivery state for the permitted Slack channel and daily-summary inclusion state.

## Downstream requirements

The completion Slack message replies in the triggering message's thread and uses the original message language. A daily summary requires a separately configured reporting channel. Both are generated from persisted mission records. A terminal agent response without a persisted terminal record does not count as a completed mission.
