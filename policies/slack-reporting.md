# Slack reporting policy

For a mission, post the outbound Slack message only to its triggering channel and thread. Do not post to a direct message or an unrelated channel, private channel, group conversation, or thread.

## Reactive mission trigger

Continuously poll only the locally configured permitted channels through Reggie's authenticated Slack connection. Process a message only once, after its timestamp is newer than the persisted polling cursor and it contains the configured member mention for `@Reggie Agent`. The mention may be represented separately from the plain message text. Do not search or replay older channel history. Record the matched mention and message identity before starting the mission.

## Temporary Computer Use ingress

Until a programmatic authenticated Slack connection is configured, an owner-approved scheduled heartbeat may use Computer Use to inspect explicitly configured permitted channels in the already authenticated `Reggie Agent` Slack user interface. For every qualifying explicit mention, add one `:emo_roger:` reaction from Reggie before submitting the candidate; if Reggie's reaction is already present, do not add it again. This is an immediate acknowledgement, remains valid when the runner later ignores or rejects the candidate, and does not replace the terminal thread reply. The local runner verifies the channel allowlist, another sender, explicit visible `@Reggie Agent` mention, immutable Slack permalink timestamp, and persisted per-channel cursor before creating a mission. When Slack exposes the mention as a separate member link, record `mentionMatched`, the exact mentioned member ID, and the original plain text separately; do not fabricate display-name text. Do not inspect unconfigured channels, replay history, process a message twice or Reggie's own reply, or use Computer Use to bypass the cursor. Replace this temporary ingress path with the authenticated Slack connection when it becomes available.

The reaction acknowledges receipt only and must never be used as the answer to a question. For a yes-or-no question, begin the first substantive reply with an explicit evidence-backed `yes` or `no` in the requester's language. When the qualifying message is a thread reply, capture the root message identity, sender, and original plain text with the candidate. Determine whether the root request is complete from persisted mission evidence. If it is incomplete, preserve it as the mission's actionable request and use the newer reply as follow-up context; a status question does not supersede or cancel the root work.

For installation on another machine, schedule the temporary ingress in Asia/Tokyo time: every 10 minutes from 09:00 inclusive until 18:00 exclusive, and every 30 minutes outside that window. The schedules must not overlap.

## Mission communication phases

When a request needs work beyond an immediate answer, including a system update, code change, file creation, or file update, send an acknowledgement in the triggering Slack thread after the mission is recorded and before starting the work. Use the requester's language. State the understood request and the first work step.

While that work is in progress, send a progress update when a material stage has been completed, when the task is still in progress at a later scheduled check, or when a blocker changes the expected path. State what Reggie is working on, what has been completed, and what remains. Do not wait until final completion to disclose material progress. Do not send duplicate updates with no material change.

Record every acknowledgement, progress update, and completion reply with its Slack message identity and delivery state in the mission evidence.

When the original requester sends a newer explicit `@Reggie Agent` reply in the active mission thread that changes the request or plan, record it as a plan change for that mission rather than creating a new mission. Apply the changed instruction, revise the remaining plan, and acknowledge the revised plan in the same thread before continuing. If the changed instruction conflicts with a required boundary, explain the blocker and request the necessary decision.

When a newer reply asks whether earlier work is complete, answer the status question directly from persisted evidence. If the answer is no and the earlier request remains actionable, continue or resume that request under the same thread context instead of treating the status check as the entire mission.

## Completion message

After each execution, Reggie sends one result reply in the triggering Slack thread, using the triggering message's language. It asks the requester to reply in that thread with an explicit `@Reggie Agent` mention and state whether the result is satisfactory.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not label an acknowledgement or progress update as a completion message.

Accept evaluation only when it is newer than the previous mission message, comes from the original requester, belongs to the original mission thread, and explicitly mentions `@Reggie Agent`. Route it to that awaiting-evaluation mission instead of creating a new mission. When the requester clearly approves, record the mission as `succeeded`. When the requester asks for changes or says they are not satisfied, record the feedback, queue the next iteration of that same mission, and use the feedback in that iteration. Do not infer approval from an unclear response. Continue this loop until approval, cancellation, failure, or `awaiting_owner_input`.

## Retrospective reports

On the first scheduled agent check after each daily, weekly, or monthly reporting boundary, Reggie reviews only the completed period's persisted mission records, requester evaluations, Slack delivery records, and artifact or pull-request references. It writes and pushes one versioned retrospective report before posting a concise summary and link to the configured reporting channel. Do not create a duplicate report for the same period.

Every report includes `What worked well`, `What did not work`, and `Improvements to better serve the user`. Every conclusion must name the supporting mission ID or report evidence. When no missions occurred in the period, state that no activity occurred and do not invent conclusions.
