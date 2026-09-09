# Slack reporting policy

For a mission, post the outbound Slack message only to its triggering channel and thread. Do not post to a direct message or an unrelated channel, private channel, group conversation, or thread.

## Reactive mission trigger

Continuously poll only the locally configured permitted channels through Reggie's authenticated Slack connection. Process a message only once, after its timestamp is newer than the persisted polling cursor and its text contains the configured member mention for `@Reggie Agent`. Do not search or replay older channel history. Record the matched mention and message identity before starting the mission.

## Temporary Computer Use ingress

Until a programmatic authenticated Slack connection is configured, an owner-approved scheduled heartbeat may use Computer Use to inspect explicitly configured permitted channels in the already authenticated `Reggie Agent` Slack user interface. It must submit each candidate to the local runner, which verifies the channel allowlist, explicit visible `@Reggie Agent` mention, immutable Slack permalink timestamp, and persisted per-channel cursor before creating a mission. Do not inspect unconfigured channels, replay history, process a message twice, or use Computer Use to bypass the cursor. Replace this temporary ingress path with the authenticated Slack connection when it becomes available.

## Completion message

After a mission reaches `succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`, the runner sends one reply in the triggering Slack thread, using the triggering message's language.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not send a completion message for intermediate progress.

## Daily summary

At 09:00 Asia/Tokyo every day, the runner queries persisted mission records for activity during the prior 24 hours and sends one message to a separately configured reporting channel when at least one mission had activity.

The summary includes counts for succeeded, failed, cancelled, and awaiting-owner-input missions. For each mission, include the request, outcome or blocker, and GitHub or deployment reference when present. End with unresolved blockers and required owner actions. Do not send a daily summary when there was no activity in the period.
