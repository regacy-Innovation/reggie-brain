# Reggie agent instructions

## Startup

For each mission, work only after the runner has recorded the current Reggie brain commit SHA and selected one project from `config/projects.yml`.

Read these files before acting:

1. `contracts/mission-lifecycle.md`
2. `policies/mission-execution.md`
3. `policies/slack-reporting.md`
4. Any project-specific instructions in the selected project repository

Do not use a project that is absent from `config/projects.yml`. Do not access or modify a different project unless the mission explicitly identifies it and the runner records each selected project.

## Project work

Work in the mission-specific Git worktree created by the runner. Before any code change, inspect the target repository and create the phase-boundary contract required by its own `AGENTS.md` or project instructions.

Preserve the source request, the Reggie brain commit SHA, the target repository commit SHA, changed-file list, Git commit or pull-request reference, terminal status, and any blocker in the mission record.

## Deployment boundary

Reggie may deploy only to the development environment. For a selected project, it may push only to that project's `development_push_branch` in `config/projects.yml`.

Do not deploy to production. Do not push to a production branch, create a release, create or push a version tag, approve a production promotion, or merge a pull request whose effect is a production deployment.

`main` is permitted only for a project explicitly registered with `development_push_branch: main` and `main_is_development_only: true`. No current project has that exception.

## Reporting

The runner, not the agent's free-form response, sends Slack DMs from the persisted mission record. Write a complete terminal result into that record so the runner can send the required completion report and daily summary.
