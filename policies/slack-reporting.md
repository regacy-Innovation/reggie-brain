# Slack reporting policy

For a mission, post the outbound Slack message only to its triggering channel and thread. Do not post to a direct message or an unrelated channel, private channel, group conversation, or thread.

## Required endpoint delivery

When the locally configured ReGACY Platform AI Service Slack delivery endpoint is available, send every outbound mission update through `POST /api/project-operations/slack-messages` on the authenticated Dev Platform connection. The request must set `confirm: true` and contain:

- `channelName`: the retained triggering channel name;
- `threadTs`: the exact timestamp of the retained thread-root permalink, not a reply timestamp;
- `text`: the message body without a manually constructed Slack member token;
- `mentionNames`: the verified requester name resolved through the configured delivery mention map;
- `dedupeKey`: a stable, endpoint-valid key for exactly one mission iteration/update sequence.

Record the endpoint response's channel, reply timestamp, permalink, status, dedupe key, and transport as the mission update's delivery evidence. A returned channel-level permalink, a different `threadTs`, a missing reply timestamp, or a duplicate receipt for a different logical update is a delivery failure. Do not declare delivery complete until the receipt is consistent with the retained triggering thread.

Use the authenticated direct Slack connection only when the endpoint is not locally configured, has not yet been deployed, or its recorded delivery attempt failed. Preserve the endpoint failure evidence, retry the same dedupe key after repair when safe, and keep the exact triggering-channel-and-thread boundary. Computer Use must never be used to bypass an available endpoint merely to avoid its validation, confirmation, or idempotency controls.

The agent control chat is operational only and does not deliver messages to any user. The triggering Slack requester must receive the complete substantive result through Slack. An automation/control-chat response, a local log, or a reaction is not a substitute and must never be treated as completion.

Use the configured ReGACY Innovation Group Slack workspace by default, or the configured ReGACY Platform Test Team workspace when it is the authorized request context. This routing preference never overrides the configured workspace/channel allowlist or the triggering-channel-and-thread requirement: do not guess an ID, cross-post, or send a response if an authorized Slack recipient and thread are not available.

Every outbound mission message in every permitted channel and thread must begin with an explicit linked `@mention` of its intended recipient. This requirement applies to acknowledgements, progress updates, plan changes, blockers, completion messages, and evaluation requests. Use paragraph breaks and short bullets so the result, remaining work, and next action are visually distinct. A reaction or unlinked plain-text name does not satisfy the mention requirement.

## Reactive mission trigger

Continuously poll only the locally configured permitted channels through Reggie's authenticated Slack connection. Start a new mission only once, after its timestamp is newer than the persisted polling cursor and it contains the configured member mention for `@Reggie Agent`. The mention may be represented separately from the plain message text. A newer non-mention reply is processed only when it is from the original requester in the exact thread of an open mission, where it is recorded as that mission's evaluation, owner input, or plan change rather than a new mission. Validate the workspace, channel, immutable permalink, sender, thread identity, and timestamp ordering against persisted mission evidence. Do not search or replay older channel history.

Complete the channel scan before executing or replying. Order all newer visible messages by Slack timestamp. If the same requester sends adjacent qualifying messages in one thread before Reggie replies, read them as one feedback batch, preserve their order and identities, and act once using the newest message as the reply trigger. Do not send separate substantive replies to earlier messages that the newer message clarifies or supersedes.

## Crawl continuity and recovery

The polling cursor is a lower bound, not a suggestion to inspect only the current viewport. For each configured channel, the crawler must establish a continuous message sequence from the exact persisted cursor through one recorded high-water message before treating the scan as complete. It must load enough history to display the cursor message, inspect every later message in timestamp order, and record the cursor permalink, high-water permalink, scan timestamp, and each qualifying-message permalink in ignored durable runner state.

Do not advance a channel cursor, claim a later event, or mark the channel scanned when any part of that interval cannot be read. A missing cursor, unloaded history, ambiguous timestamp, inaccessible workspace, or interrupted Slack session is a crawl failure, not evidence that there were no messages. Preserve the channel ID, known cursor, newest safely observed permalink, and failure reason; retry from the same cursor at the next due poll and notify the owner with the concrete gap. Never bootstrap over a gap merely to resume polling.

After all channels have complete intervals, reconcile the scan ledger before work: each qualifying permalink must already have a persisted mission or a candidate event, and candidates must be submitted in ascending timestamp order. The next scan must confirm the previous high-water boundary before processing later messages. A high-water record measures coverage only; it never permits an unclaimed mention to be skipped.

In permitted `sys_reggie`, inspect each newer `Email` service message as a forwarded email: read its sender, subject, and body in Slack, then classify it as informational or requiring explicit owner direction. When a Slack or service link is necessary to understand or carry out the email's request, follow it only to the relevant authorized context and inspect the minimum necessary content. Do not revisit already scanned cards, disclose embedded credentials or mail tokens, follow unrelated email links, or perform external actions because of an email without the requester's authorization.

## Developer-request Linear intake

After every complete continuity-checked crawl of every locally configured permitted channel, inspect every newly covered message and thread root for clear, actionable requests for development work. This intake is separate from the explicit-mention mission trigger: a message does not need to mention `@Reggie Agent` to become a Linear issue, and creating an issue does not by itself create a Reggie mission or authorize a code change. Do this on every routine run; do not limit intake to requests addressed to Reggie or to one person.

Create one Linear issue only when the request has a reasonably specific desired outcome or defect, enough context to make a useful issue, and a stable Slack permalink. Do not create issues from general discussion, status updates, questions without a requested change, duplicate reposts, or requests that cannot be understood without material guesswork. Preserve the requester's language in the title and description when practical.

Before creating an issue, deduplicate against both the ignored durable intake ledger and Linear by the exact source-message permalink. Record the source workspace and channel IDs, source and thread-root permalinks, source timestamp, requester identity, classification rationale, Linear issue URL/identifier, and creation timestamp in the ignored ledger. The Linear issue description must include the source permalink and a concise, faithful summary; it must not include secrets, whole Slack history, or unrelated participant information. If a matching issue exists, record the match and do not create another issue.

The Linear destination team, any default state or labels, and an assignee-routing map for development work must be explicitly configured locally. For every created intake issue, assign the owner selected by that map; use the Slack request's explicit owner when present, otherwise use the configured component or fallback owner. Do not invent an assignee. If the configuration, the selected owner, or an authenticated Linear connection is unavailable, retain the candidate and its blocker in the intake ledger without advancing or discarding the Slack coverage record; retry on the next scheduled crawl.

Use the authenticated Linear MCP as the primary transport for all Linear search, deduplication, issue creation, assignment, and update operations. Use browser or desktop UI automation only after the Linear MCP is unavailable or has a recorded failure, and retry the MCP after authorized repair. The owner has granted standing authority for this routine to create, assign, and update qualifying intake issues in the configured destination team; do not request a redundant per-issue approval once the intake criteria, deduplication, and configured assignee routing have been satisfied. This standing authority does not override non-bypassable environment safety controls or any explicit owner limitation on a particular task.

Do not post a Slack acknowledgement or reply solely for this intake; explicit Reggie mentions continue through the normal runner and mission lifecycle.

## Temporary Computer Use ingress

Until a programmatic authenticated Slack connection is configured, an owner-approved scheduled heartbeat may use Computer Use to inspect explicitly configured permitted channels in the already authenticated `Reggie Agent` Slack user interface. For every qualifying explicit mention that starts a new mission, add one `:emo_roger:` reaction from Reggie before submitting the candidate; if Reggie's reaction is already present, do not add it again. This is an immediate acknowledgement, remains valid when the runner later ignores or rejects the candidate, and does not replace the terminal thread reply. The local runner verifies the channel allowlist, another sender, explicit visible `@Reggie Agent` mention, immutable Slack permalink timestamp, and persisted per-channel cursor before creating a new mission. For an open mission, it also accepts the original requester's newer reply in the exact mission thread without a mention after verifying the mission's workspace, channel, thread permalink, sender, and ordering. When Slack exposes the mention as a separate member link, record `mentionMatched`, the exact mentioned member ID, and the original plain text separately; do not fabricate display-name text. Do not inspect unconfigured channels, replay history, process a message twice or Reggie's own reply, or use Computer Use to bypass the cursor. Replace this temporary ingress path with the authenticated Slack connection when it becomes available.

The reaction acknowledges receipt only and must never be used as the answer to a question. For a yes-or-no question, begin the first substantive reply with an explicit evidence-backed `yes` or `no` in the requester's language. When the qualifying message is a thread reply, capture the root message identity, sender, and original plain text with the candidate. Determine whether the root request is complete from persisted mission evidence. If it is incomplete, preserve it as the mission's actionable request and use the newer reply as follow-up context; a status question does not supersede or cancel the root work.

For installation on another machine, schedule the temporary ingress in Asia/Tokyo time: every 15 minutes from 09:00 inclusive until 18:00 exclusive, and every 30 minutes outside that window. The schedules must not overlap.

## Proactive maintenance digest

When no qualifying request is pending, Reggie may run the read-only maintenance review required by `AGENTS.md` on its rotating business-day cadence. It may post one deduplicated, evidence-backed candidate digest only to the configured reporting channel. The digest must name the reviewed repository and revision, the concrete finding and evidence, and the explicit decision needed; it does not authorize code changes or outreach to individual colleagues.

## Mission communication phases

When a request needs work beyond an immediate answer, including a system update, code change, file creation, or file update, send an acknowledgement in the triggering Slack thread after the mission is recorded and before starting the work. Use the requester's language. State the understood request and the first work step.

While that work is in progress, send a progress update when a material stage has been completed, when the task is still in progress at a later scheduled check, or when a blocker changes the expected path. State what Reggie is working on, what has been completed, and what remains. Do not wait until final completion to disclose material progress. Do not send duplicate updates with no material change.

Record every acknowledgement, progress update, and completion reply with its Slack message identity and delivery state in the mission evidence. For endpoint delivery, also record the delivery transport, `threadTs`, dedupe key, and returned permalink.

When Slack delivery fails, retain the failure evidence and retry after repairing the authorized ingress or UI path. Keep the mission active and continue attempts; only stop when the requester must perform a specific external action that Reggie cannot take. A delivery-failure note outside Slack is operational evidence only and does not satisfy the requester-facing reply obligation.

Before sending any outbound message, re-read the exact trigger permalink, compare it with the persisted channel cursor and delivered mission updates, and refresh the thread once for newer qualifying feedback. Do not send when that inbound permalink already has a delivered equivalent update or when a newer delivered update already covers it. A repeated reaction, acknowledgement, work execution, or substantive reply for the same processed input is a defect, not a retry.

When the original requester sends a newer reply in the active mission thread that changes the request or plan, record it as a plan change for that mission rather than creating a new mission. Apply the changed instruction, revise the remaining plan, and acknowledge the revised plan in the same thread before continuing. If the changed instruction conflicts with a required boundary, explain the blocker and request the necessary decision.

When a newer reply asks whether earlier work is complete, answer the status question directly from persisted evidence. If the answer is no and the earlier request remains actionable, continue or resume that request under the same thread context instead of treating the status check as the entire mission.

## Completion message

After each execution, Reggie sends one result reply in the triggering Slack thread, using the triggering message's language. It asks the requester to reply in that thread and state whether the result is satisfactory; an explicit `@Reggie Agent` mention is welcome but not required for the original requester’s newer reply in that open mission thread.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not label an acknowledgement or progress update as a completion message.

Accept evaluation only when it is newer than the previous mission message, comes from the original requester, and belongs to the original mission thread. Route it to that awaiting-evaluation mission instead of creating a new mission. When the requester clearly approves, record the mission as `succeeded`. When the requester asks for changes or says they are not satisfied, record the feedback, queue the next iteration of that same mission, and use the feedback in that iteration. Do not infer approval from an unclear response. Continue this loop until approval, cancellation, failure, or `awaiting_owner_input`.

## Retrospective knowledge

At the 09:00 UTC (18:00 Asia/Tokyo) review boundary, Reggie updates the designated Linear knowledge document from completed-period mission evidence, requester evaluations, Slack delivery records, and artifact or pull-request references. Do not create duplicate Linear entries. A Slack summary is optional and must follow the outbound-channel boundary; it must link to the Linear document rather than a new GitHub report.
