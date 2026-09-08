# Reggie brain

Versioned operating instructions for the always-on Reggie agent runner.

The runner updates this repository before each mission, records the checked-out commit SHA in the mission record, then starts the coding agent in the selected project worktree. `AGENTS.md` is the entrypoint for the coding agent.

## Repository contents

- `AGENTS.md` defines the agent's required operating behavior.
- `contracts/mission-lifecycle.md` defines the data that must be retained between Slack, the runner, the coding agent, GitHub, and reporting.
- `policies/` contains the Slack reporting and mission execution rules.
- `config/projects.yml` is the verified allowlist of local project clones.
- `config/runtime.example.yml` is a non-secret configuration template for the local runner.

## Runner bootstrap contract

For every new mission, the runner must fetch and fast-forward this repository; read the current `AGENTS.md` and applicable policy files; record this repository's commit SHA; resolve the target only from `config/projects.yml`; update the selected project and create a mission-specific Git worktree; and send reporting DMs from persisted mission records.

This repository contains no Slack token, GitHub token, API key, or owner Slack user ID. The runner stores secrets outside Git.

## Adding a project

Register a project only after its local clone, origin URL, and upstream branch have been verified. Keep the project identifier stable because it is recorded with mission history and Slack reports.
