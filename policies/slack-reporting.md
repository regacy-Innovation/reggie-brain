# Slack reporting policy

For a mission, post the outbound Slack message only to its triggering channel and thread. Do not post to a direct message or an unrelated channel, private channel, group conversation, or thread.

## Reactive mission trigger

Continuously poll only the locally configured permitted channels through Reggie's authenticated Slack connection. Process a message only once, after its timestamp is newer than the persisted polling cursor and its text contains the configured member mention for `@Reggie Agent`. Do not search or replay older channel history. Record the matched mention and message identity before starting the mission.

## Temporary Computer Use ingress

Until a programmatic authenticated Slack connection is configured, an owner-approved scheduled heartbeat may use Computer Use to inspect explicitly configured permitted channels in the already authenticated `Reggie Agent` Slack user interface. It must submit each candidate to the local runner, which verifies the channel allowlist, another sender, explicit visible `@Reggie Agent` mention, immutable Slack permalink timestamp, and persisted per-channel cursor before creating a mission. Do not inspect unconfigured channels, replay history, process a message twice or Reggie's own reply, or use Computer Use to bypass the cursor. Replace this temporary ingress path with the authenticated Slack connection when it becomes available.

For installation on another machine, schedule the temporary ingress in Asia/Tokyo time: every 10 minutes from 09:00 inclusive until 18:00 exclusive, and every 30 minutes outside that window. The schedules must not overlap.

## Completion message

After each execution, Reggie sends one result reply in the triggering Slack thread, using the triggering message's language. It asks the requester to reply in that thread with an explicit `@Reggie Agent` mention and state whether the result is satisfactory.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not send a completion message for intermediate progress.

Accept evaluation only when it is newer than the previous mission message, comes from the original requester, belongs to the original mission thread, and explicitly mentions `@Reggie Agent`. Route it to that awaiting-evaluation mission instead of creating a new mission. When the requester clearly approves, record the mission as `succeeded`. When the requester asks for changes or says they are not satisfied, record the feedback, queue the next iteration of that same mission, and use the feedback in that iteration. Do not infer approval from an unclear response. Continue this loop until approval, cancellation, failure, or `awaiting_owner_input`.

## Retrospective reports

On the first scheduled agent check after each daily, weekly, or monthly reporting boundary, Reggie reviews only the completed period's persisted mission records, requester evaluations, Slack delivery records, and artifact or pull-request references. It writes and pushes one versioned retrospective report before posting a concise summary and link to the configured reporting channel. Do not create a duplicate report for the same period.

Every report includes `What worked well`, `What did not work`, and `Improvements to better serve the user`. Every conclusion must name the supporting mission ID or report evidence. When no missions occurred in the period, state that no activity occurred and do not invent conclusions.
