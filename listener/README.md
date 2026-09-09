# Local Reggie Slack listener

This package runs on this computer. It keeps a Slack Socket Mode connection open, receives `@Reggie` mentions in the permitted channel, and launches the installed local `codex exec` command. It does not use the online `regacy-platform-slack-listener` service.

## Setup

1. Create a dedicated Slack app and bot for this local listener, enable Socket Mode and the `app_mention` event, grant the bot `app_mentions:read` and `chat:write`, then install it in the permitted channel. Do not reuse the online listener's Slack app credentials, because both listeners would receive the same event.
2. Copy `.env.example` to `.env` in this directory and set the dedicated Slack app credentials and permitted channel ID.
3. Keep `REGGIE_ROLE=developer` in the brain repository's local `.env`.
4. Install dependencies with `npm install` in this directory.
5. Start it with `npm start` and keep it running through a Windows startup task or service.

The listener uses `runtime/missions.sqlite` for durable local state. It starts one Codex mission at a time. It does not discover Slack history: only a newly delivered `app_mention` starts a mission.

Each coding request must begin with an exact registered project ID:

```text
@Reggie project=regacy-platform-reggie-service Describe the requested change.
```

This prevents the listener from guessing a repository from request text.

Each mission creates `worktrees/<mission-id>/<project-id>` under the brain repository, runs Codex there, and records a terminal bundle under `missions/YYYY/MM/DD/<mission-id>/`. The listener sends the terminal result to the original Slack thread.
