# Local Reggie Slack listener

This package runs on this computer. It keeps a Slack Socket Mode connection open, receives `@Reggie` mentions in the permitted channel, and launches the installed local `codex exec` command. It does not use the online `regacy-platform-slack-listener` service.

## Install on a new computer

1. Install Git, Node.js 22.5 or later, and Codex CLI. Sign in to Codex on the computer that will run Reggie.
2. Clone this repository to `C:\Reggie\brain`.
3. Copy `C:\Reggie\brain\.env.example` to `C:\Reggie\brain\.env`. Keep `REGGIE_ROLE=developer` there.
4. For each project Reggie may change, clone its exact `origin` from `config/projects.yml` into `C:\Reggie\projects\<project-id>`. For example, the registered `regacy-platform-reggie-service` clone belongs at `C:\Reggie\projects\regacy-platform-reggie-service`.
5. Create a dedicated Slack app and bot for this local listener, enable Socket Mode and the `app_mention` event, grant the bot `app_mentions:read` and `chat:write`, then install it in the permitted channel. Do not reuse the online listener's Slack app credentials, because both listeners would receive the same event.
6. Copy `.env.example` to `.env` in this directory. Set the dedicated Slack app credentials. Keep the local roots shown in the example unless the computer uses a different `C:\Reggie` location.
7. Run `npm ci` in this directory.
8. Run `npm start`. Keep the process running through a Windows startup task or service.

The listener uses `runtime/missions.sqlite` for durable local state. It starts one Codex mission at a time. It does not discover Slack history: only a newly delivered `app_mention` starts a mission.

Each coding request must begin with an exact registered project ID:

```text
@Reggie project=regacy-platform-reggie-service Describe the requested change.
```

This prevents the listener from guessing a repository from request text.

Before creating a worktree, the listener verifies that the local clone's `origin` exactly matches the registry. It never treats a local folder with the same name as a valid project clone.

Each mission creates `worktrees/<mission-id>/<project-id>` under the brain repository, runs Codex there, and records a terminal bundle under `missions/YYYY/MM/DD/<mission-id>/`. The listener sends the terminal result to the original Slack thread.
