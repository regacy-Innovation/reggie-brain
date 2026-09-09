# Reggie brain

Versioned shared and role-specific operating instructions, plus the local Slack listener that launches Reggie on this computer.

The runner updates this repository before each mission, records the checked-out commit SHA in the mission record, then starts the selected role in the required mission context. `AGENTS.md` is the entrypoint for the agent.

For installation on a new computer, follow [`listener/README.md`](listener/README.md). It covers the local folder layout, dedicated Slack app, local project clones, and startup process.

## Repository contents

- `AGENTS.md` defines shared agent behavior.
- `config/roles.yml` is the authoritative role registry.
- `roles/` contains the selected role's specialized instructions.
- `listener/` is the local Socket Mode listener and Codex launcher. It is separate from the online Slack listener.
- `contracts/mission-lifecycle.md` defines the data that must be retained between Slack, the runner, the coding agent, GitHub, and reporting.
- `policies/` contains the Slack reporting and mission execution rules.
- `config/projects.yml` is the verified allowlist of local project clones.
- `config/runtime.example.yml` is a non-secret configuration template for the local runner.

## Runner bootstrap contract

For every new mission, the runner must fetch and fast-forward this repository; read the current `AGENTS.md`, applicable shared policy files, and the `REGGIE_ROLE` profile selected from `config/roles.yml`; record this repository's commit SHA and selected role; then follow that role's project and delivery requirements. It replies only in the triggering Slack thread from persisted mission records or the configured Slack plugin completion path.

This repository contains no Slack token, GitHub token, API key, or other credentials. The non-secret Slack routing identifiers in `config/runtime.example.yml` are configuration examples; real runtime values and all credentials stay outside Git.

## Adding a project

Register a project only after its local clone, origin URL, and upstream branch have been verified. Keep the project identifier stable because it is recorded with mission history and Slack reports.
