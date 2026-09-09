# Reggie local runner

This dependency-free Node runner is the durable mission gate for the temporary Computer Use Slack ingress. The scheduled heartbeat reads only the configured channels in Slack, writes a candidate event JSON file, and invokes this runner. The runner validates the event before it persists a cursor or creates a mission bundle.

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
  "mentionMatched": true
}
```

`mentionMatched` may be `true` only after Computer Use has confirmed the visible message contains an explicit `@Reggie Agent` mention with the configured member ID. The candidate must contain the immutable Slack permalink for the exact message. Messages authored by `Reggie Agent` are always rejected to prevent reply loops.

Claim it before starting work:

```sh
node runner/src/index.mjs claim \
  --config config/runtime.local.json \
  --event /absolute/path/to/candidate.json
```

The command validates the configured role, creates a mission bundle under `missions/YYYY/MM/DD/`, and prints the mission ID. After every execution, deliver the result in the original Slack thread and ask the requester to reply with an explicit `@Reggie Agent` mention to approve it or request changes. Then persist the result as awaiting evaluation:

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

Then execute it with its original request and saved iteration feedback. It repeats the result and evaluation sequence until approval, cancellation, failure, or `awaiting_owner_input`. The runner stores its cursor and mission index in ignored `runtime/poll-state.json`.
