# Slack reporting policy

All outbound Slack messages must be posted only to `C074BCJGQGP` (`#dev_system-development-team`). Do not post to a direct message, another channel, a private channel, or a group conversation.

## Reactive mission trigger

Process only newly delivered Slack `app_mention` events in `C074BCJGQGP` that contain the installed Reggie bot mention. Do not poll, crawl, search, or replay the channel to find requests. Record the matched mention and message identity before starting the mission.

## Completion message

After a mission reaches `succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`, the runner sends one reply in the triggering Slack thread in `C074BCJGQGP`, using the triggering message's language.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not send a completion message for intermediate progress.

## Daily summary

At 09:00 Asia/Tokyo every day, the runner queries persisted mission records for activity during the prior 24 hours and sends one message to `C074BCJGQGP` when at least one mission had activity.

The summary includes counts for succeeded, failed, cancelled, and awaiting-owner-input missions. For each mission, include the request, outcome or blocker, and GitHub or deployment reference when present. End with unresolved blockers and required owner actions. Do not send a daily summary when there was no activity in the period.
