# Reggie local runner

This dependency-free Node runner is the durable mission gate for the temporary Computer Use Slack ingress. The scheduled heartbeat reads only the configured channels in Slack, writes a candidate event JSON file, and invokes this runner. The runner validates the event before it persists a cursor or creates a mission bundle.

This is not a replacement for a programmatic Slack connection. It does not read Slack or send a reply itself; Computer Use performs those UI actions while this runner preserves the authorization and delivery record.

## Local configuration

Copy `config/runtime.local.example.json` to the ignored `config/runtime.local.json`. Configure only the workspace, `Reggie Agent` display name, and channels the owner has explicitly permitted. Do not add all visible channels by default.

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
  "text": "The visible message text",
  "mentionMatched": true
}
```

`mentionMatched` may be `true` only after Computer Use has confirmed the visible message contains an explicit `@Reggie Agent` mention. The candidate must contain the immutable Slack permalink for the exact message.

Claim it before starting work:

```sh
node runner/src/index.mjs claim \
  --config config/runtime.local.json \
  --event /absolute/path/to/candidate.json
```

The command creates a mission bundle under `missions/YYYY/MM/DD/` and prints the mission ID. When the mission reaches a terminal state and its Slack thread reply has been delivered, persist that outcome:

```sh
node runner/src/index.mjs complete \
  --mission <mission-id> \
  --status succeeded \
  --summary-file /absolute/path/to/summary.md \
  --delivery-state delivered
```

Allowed terminal statuses are `succeeded`, `failed`, `cancelled`, and `awaiting_owner_input`. The runner stores its cursor and mission index in ignored `runtime/poll-state.json`.
