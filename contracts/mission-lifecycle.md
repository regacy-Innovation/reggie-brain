# Mission lifecycle contract

## Authoritative inputs

| Input | Authority | Required meaning |
| --- | --- | --- |
| Slack request | Newly polled Slack message stored by the agent | Triggering message text, sender, channel, message timestamp, thread timestamp, original message language, matched Reggie member ID even when Slack exposes it as a separate link, the thread-root message identity, sender, and original plain request text when the trigger is a reply, and attached Slack file IDs, names, and MIME types |
| Slack trigger configuration | Local agent configuration | Permitted channel IDs, the `@Reggie Agent` member identity or temporary Computer Use display-name match, and the persisted polling cursor |
| Brain revision | Reggie brain Git commit | Exact instructions used for this mission |
| Role selection | `REGGIE_ROLE` validated against `config/roles.yml` | Role ID and Git-versioned role instruction path used for this mission |
| Target project | `config/projects.yml` | Registered local path, origin URL, and upstream branch |
| Project revision | Target worktree Git commit | Code revision inspected by the agent |
| User evaluation | Newer explicit `@Reggie Agent` reply from the original requester in the original Slack thread | Approval or revision feedback for the current mission iteration |
| Plan change | Newer explicit `@Reggie Agent` reply from the original requester in an active mission thread | Changed request or work plan for the existing mission |
| Retrospective source | Persisted mission records, user evaluations, Slack delivery records, artifact or pull-request references, and prior retrospective reports | Evidence for daily, weekly, and monthly reports and historical progress comparison |

## Agent input manifest

The agent receives only the original request, the instruction to reply in the original message language, shared brain instructions, the selected role instructions, selected project registration when applicable, relevant project instructions, explicitly downloaded Slack artifact paths, extracted-text paths when available, and files explicitly read from the selected worktree. It must not receive whole database records, unrelated repository contents, secrets, or other mission transcripts.

## Persisted outputs

The runner must persist one mission record containing the mission ID; Slack message/thread identities; matched configured member mention; the triggering message and retained thread-root request when applicable; Reggie brain commit SHA; role ID and role instruction path; target project ID, local-path identity, origin URL, starting revision, permitted development push branch, and deployment environment when applicable; worktree path and branch name when applicable; every acknowledgement, progress update, completion reply, and plan change with its Slack message identity and delivery state; every iteration number, result, evaluation request, feedback message identity, and approval or revision outcome; terminal status (`succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`); final result, changed files, Git commit, pull request, deployment reference, blocker, and completion timestamp as applicable; plus delivery state for the permitted Slack channel and daily-summary inclusion state. For a web-system bug fix, include the before and after video artifact paths, checksums, and pull-request attachment references.

When a mission is `awaiting_owner_input`, a newer explicit mention from the original requester in the same Slack thread may resume that mission. The runner must validate that event, retain it as the next iteration's owner input, apply the currently selected registered role, and return the same mission to `queued`; the agent must not create a replacement mission that loses the original request.

## Downstream requirements

Each qualifying explicit mention receives one immediate `:emo_roger:` reaction from Reggie before runner submission, unless that Reggie reaction is already present. This receipt acknowledgement remains valid if the candidate is ignored or rejected. For substantive work, a separate acknowledgement Slack message precedes the work and is recorded as mission evidence. Progress messages in the triggering thread describe the current work, completed work, and remaining work. A newer requester plan change in that thread updates the same mission and is acknowledged before the revised work continues. Neither the reaction nor an acknowledgement or progress message replaces the execution result. Each execution-result Slack message replies in the triggering message's thread, uses the original message language, and asks for evaluation with an explicit `@Reggie Agent` reply in that thread. An approval closes the mission. Revision feedback queues the next iteration of that same mission and is included in its agent input. A daily summary requires a separately configured reporting channel. Both are generated from persisted mission records.

Every retrospective report must identify its completed reporting period and cite the mission IDs, prior report references, and evidence used for each conclusion. It must compare unresolved prior improvements with later evidence, identify recurring issues, and distinguish demonstrated improvement from an unsupported claim. It must not infer outcomes, user satisfaction, or agent actions that are absent from the persisted records.
