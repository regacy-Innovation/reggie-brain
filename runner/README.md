# Reggie local runner

This dependency-free Node runner is the durable mission gate for the temporary Computer Use Slack ingress. The scheduled heartbeat reads only the configured channels in Slack, writes a candidate event JSON file, and invokes this runner. The runner validates the event before it persists a cursor or creates a mission bundle.

## Polling schedule

When installing the heartbeat on another machine, configure it in `Asia/Tokyo`: every 10 minutes from 09:00 inclusive to 18:00 exclusive, and every 30 minutes outside those hours. The sample local configuration records this required cadence under `slack.polling`; the runner does not schedule itself.

This is not a replacement for a programmatic Slack connection. It does not read Slack or send a reply itself; Computer Use performs those UI actions while this runner preserves the authorization and delivery record.

## Local configuration

Copy `config/runtime.local.example.json` to the ignored `config/runtime.local.json`. Configure one role ID from `config/roles.yml`, the workspace, `Reggie Agent` display name and member ID, and channels the owner has explicitly permitted. Do not add all visible channels by default.

The initial local configuration for this computer permits only `sys_reggie`. Its initial cursor is set to the latest observed message when the runner is bootstrapped, so history is not replayed.

## Commands

Bootstrap a newly permitted channel at its latest observed Slack message permalink:

```sh
node runner/src/index.mjs bootstrap \
  --config config/runtime.local.json \
  --channel C00000000 \
  --permalink https://workspace.slack.com/archives/C00000000/p1234567890123456
```

For each new candidate found through Computer Use, write an event file locally:

```json
{
  "channelId": "C00000000",
  "permalink": "https://workspace.slack.com/archives/C00000000/p1234567890123456",
  "threadPermalink": "https://workspace.slack.com/archives/C00000000/p1234567890123456",
  "senderId": "visible-slack-sender-identity",
  "mentionedUserId": "U00000000",
  "text": "The visible message text",
  "mentionMatched": true,
  "threadRoot": {
    "permalink": "https://workspace.slack.com/archives/C00000000/p1234567890123456",
    "senderId": "visible-root-sender-identity",
    "text": "The original thread-root request"
  }
}
```

`mentionMatched` may be `true` only after Computer Use has confirmed the visible message contains an explicit `@Reggie Agent` mention whose Slack link resolves to the configured `mentionedUserId`. Slack may expose that mention as a separate member link rather than including `@Reggie Agent` in the captured plain `text`; do not synthesize or prepend mention text. The runner treats `mentionMatched: true` plus an exact configured member-ID match as authoritative. The candidate must contain the immutable Slack permalink for the exact message. Messages authored by the configured Reggie member ID are always rejected to prevent reply loops.

Before invoking `claim` or `evaluate`, add one `:emo_roger:` reaction from Reggie to the qualifying Slack message as an immediate acknowledgement. If that Reggie reaction is already present, do not add it again. The reaction does not replace the single terminal reply in the triggering thread and remains appropriate when a later runner check ignores or rejects the candidate.

Include `threadRoot` whenever the triggering message is a thread reply. Its permalink must match `threadPermalink` exactly, and its text must be the original plain root-message text. The runner retains the root request separately from the triggering follow-up. A yes-or-no follow-up receives a direct evidence-backed yes-or-no reply; when the root request is unfinished, the agent continues that work rather than treating the status check as a replacement request.

Claim it before starting work:

```sh
node runner/src/index.mjs claim \
  --config config/runtime.local.json \
  --event /absolute/path/to/candidate.json
```

The command validates the configured role, creates a mission bundle under `missions/YYYY/MM/DD/`, and prints the mission ID. For substantive work, first send an acknowledgement in the Slack thread and record it:

```sh
node runner/src/index.mjs record-update \
  --mission <mission-id> \
  --phase acknowledged \
  --message-id <slack-message-ts> \
  --delivery-state delivered \
  --summary-file /absolute/path/to/acknowledgement.md
```

Use the same command with `progress` after a material stage or when work remains in progress at a later scheduled check. Use `plan_changed` after the requester changes the active mission's request or plan. After every execution, deliver the result in the original Slack thread and ask the requester to reply with an explicit `@Reggie Agent` mention to approve it or request changes. Record the completion reply with `--phase completed`, then persist the result as awaiting evaluation:

```sh
node runner/src/index.mjs complete \
  --mission <mission-id> \
  --status awaiting_evaluation \
  --summary-file /absolute/path/to/summary.md \
  --delivery-state delivered
```

When the heartbeat finds a qualifying message, first check whether its thread belongs to a mission awaiting evaluation. For the original requester’s explicit reply in that thread, classify clear satisfaction as `approved` and requested changes or dissatisfaction as `revision_requested`; do not create a new mission from it. Persist that evaluation with:

```sh
node runner/src/index.mjs evaluate \
  --mission <mission-id> \
  --event /absolute/path/to/evaluation.json \
  --outcome approved
```

An approval sets the mission to `succeeded`. A revision request saves the feedback and queues the next iteration. The local agent reads queued work with:

```sh
node runner/src/index.mjs next --config config/runtime.local.json
```

Before executing a returned mission, claim that queued iteration atomically:

```sh
node runner/src/index.mjs start --mission <mission-id>
```

When a mission is waiting for owner input, resume that same mission only with a newer explicit mention from the original requester in the original thread. The runner revalidates the event and applies the currently selected registered role:

```sh
node runner/src/index.mjs resume --config config/runtime.local.json --mission <mission-id> --event <owner-input-file>
node runner/src/index.mjs start --mission <mission-id>
```

Then execute it with its original request and saved iteration feedback. It repeats the result and evaluation sequence until approval, cancellation, failure, or `awaiting_owner_input`. The runner stores its cursor and mission index in ignored `runtime/poll-state.json`.
