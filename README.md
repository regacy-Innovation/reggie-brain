# Reggie brain

Versioned shared and role-specific operating instructions for Reggie.

The runner updates this repository before each mission, records the checked-out commit SHA in the mission record, then starts the selected role in the required mission context. `AGENTS.md` is the entrypoint for the agent.

Until a programmatic Slack connection is available, `runner/` provides the local, cursor-backed mission gate used by the owner-approved Computer Use heartbeat. It validates the configured channel allowlist and visible Reggie mention before creating a mission record. Follow [`runner/README.md`](runner/README.md) to configure and operate it.

## Repository contents

- `AGENTS.md` defines shared agent behavior.
- `config/roles.yml` is the authoritative role registry.
- `roles/` contains the selected role's specialized instructions.
- `runner/` contains the local cursor-backed mission gate for temporary Computer Use Slack ingress.
- `contracts/mission-lifecycle.md` defines the data that must be retained between Slack, the runner, the coding agent, GitHub, and reporting.
- `policies/` contains the Slack reporting and mission execution rules.
- `config/projects.yml` is the verified allowlist of local project clones.
- `config/runtime.example.yml` is a non-secret configuration template for the local runner.

## Runner bootstrap contract

For every new mission, the persistent agent must fetch and fast-forward this repository; read the current `AGENTS.md`, applicable shared policy files, and the `REGGIE_ROLE` profile selected from `config/roles.yml`; record this repository's commit SHA and selected role; then follow that role's project and delivery requirements. It polls its permitted Slack channels for new qualifying mentions through the authenticated Slack connection or the owner-approved temporary Computer Use ingress, and replies only in the triggering Slack thread from a persisted terminal mission record.

This repository contains no Slack token, GitHub token, API key, or other credentials. The non-secret Slack routing identifiers in `config/runtime.example.yml` are configuration examples; real runtime values and all credentials stay outside Git.

## Adding a project

Register a project only after its local clone, origin URL, and upstream branch have been verified. Keep the project identifier stable because it is recorded with mission history and Slack reports.
