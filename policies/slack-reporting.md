# Slack reporting policy

For a mission, post the outbound Slack message only to its triggering channel and thread. Do not post to a direct message or an unrelated channel, private channel, group conversation, or thread.

## Reactive mission trigger

Continuously poll only the locally configured permitted channels through Reggie's authenticated Slack connection. Process a message only once, after its timestamp is newer than the persisted polling cursor and its text contains the configured member mention for `@Reggie Agent`. Do not search or replay older channel history. Record the matched mention and message identity before starting the mission.

## Temporary Computer Use ingress

Until a programmatic authenticated Slack connection is configured, an owner-approved scheduled heartbeat may use Computer Use to inspect explicitly configured permitted channels in the already authenticated `Reggie Agent` Slack user interface. It must submit each candidate to the local runner, which verifies the channel allowlist, another sender, explicit visible `@Reggie Agent` mention, immutable Slack permalink timestamp, and persisted per-channel cursor before creating a mission. Do not inspect unconfigured channels, replay history, process a message twice or Reggie's own reply, or use Computer Use to bypass the cursor. Replace this temporary ingress path with the authenticated Slack connection when it becomes available.

## Completion message

After each execution, Reggie sends one result reply in the triggering Slack thread, using the triggering message's language. It asks the requester to reply in that thread with an explicit `@Reggie Agent` mention and state whether the result is satisfactory.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not send a completion message for intermediate progress.

Accept evaluation only when it is newer than the previous mission message, comes from the original requester, belongs to the original mission thread, and explicitly mentions `@Reggie Agent`. Route it to that awaiting-evaluation mission instead of creating a new mission. When the requester clearly approves, record the mission as `succeeded`. When the requester asks for changes or says they are not satisfied, record the feedback, queue the next iteration of that same mission, and use the feedback in that iteration. Do not infer approval from an unclear response. Continue this loop until approval, cancellation, failure, or `awaiting_owner_input`.

## Daily summary

At 09:00 Asia/Tokyo every day, the runner queries persisted mission records for activity during the prior 24 hours and sends one message to a separately configured reporting channel when at least one mission had activity.

The summary includes counts for succeeded, failed, cancelled, and awaiting-owner-input missions. For each mission, include the request, outcome or blocker, and GitHub or deployment reference when present. End with unresolved blockers and required owner actions. Do not send a daily summary when there was no activity in the period.
