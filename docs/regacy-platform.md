# ReGACY Platform guide

## Scope and authority

This guide gives Reggie the stable operating context for ReGACY Platform. It is based on the local source repositories and the Platform project constitution. It does not replace the selected repository's instructions, database schema, deployment settings, or live-system evidence.

Treat runtime deployment status, service-to-repository mappings, environment variables, database state, and active job state as live facts. Verify them for the exact mission before relying on them.

## Purpose

ReGACY Platform supports new-business creation work: research, company and solution discovery, analysis, strategy design, idea management, and Project Operations. It connects these workflows through project-scoped authorization, shared data, versioned workflows, AI services, workers, MCP tools, and multiple web applications.

`project_id` is an authorization boundary. Do not search, read, combine, or expose another project’s data merely because it belongs to the same client or has a similar name.

Generated outputs must retain their source inputs, evidence, profile or prompt, model or worker, schema, and publication provenance. Do not silently discard, replace, rename, default, or flatten these values.

## System structure

ReGACY Platform is a multi-repository system. A typical asynchronous path is:

```text
Frontend application
  -> AI Service API and workflow control
  -> PostgreSQL persistence and BullMQ/Redis queue
  -> dedicated worker
  -> persisted result with provenance
  -> API and rendered frontend result
```

The exact path is mission-specific. Trace the actual UI action, persisted record, queue payload, worker input, endpoint behavior, database output, and rendered result before stating how a workflow behaves.

### Main components

| Component | Role | Source-backed structure |
| --- | --- | --- |
| `regacy-platform-frontend-monorepo` | User-facing applications | SvelteKit 5 / Svelte 5 applications, including Portal, Manifest, Reggie, Trend Search, Idea Portal, Strategy Builder, PowerPoint, and shared UI/API/localization code. |
| `regacy-platform-ai-service` | API and workflow control plane | Node.js and TypeScript service with Fastify, Prisma/PostgreSQL access, BullMQ/Redis integration, AI operations, research, analysis, and schema/type export for frontend consumers. |
| `regacy-platform-worker-*` | Asynchronous workload execution | Separate workers process workflow jobs and persist outcomes through their specific contracts. Do not treat a worker as interchangeable with the AI Service. |
| `regacy-platform-reggie-tools` | Reggie tool surface | TypeScript package providing CLI, MCP, and LangChain exports. |
| `regacy-platform-reggie-service` | Reggie chat and tool orchestration | Node.js and TypeScript service that uses Reggie Tools and LangChain-based agent components. |
| `regacy-platform-slack-listener` | Slack ingress and response delivery | Node.js and TypeScript Slack Bolt service that forwards Slack messages to Reggie and posts responses. |
| Render services | Runtime infrastructure | Deployments, service status, health, logs, and environment configuration must be read from the exact Render service at mission time. |

## Coding conventions

Follow the selected repository's own instructions first. The cross-platform conventions below apply unless that repository gives a stricter compatible rule.

- Use TypeScript for implementation in the main services and tools.
- Frontend changes use SvelteKit 5 / Svelte 5 conventions. Reuse shared components and shared API layers rather than recreating schema types in an application.
- The AI Service is the authoritative source for API and schema types consumed by the frontend. Change a schema at its authority and regenerate or export the dependent types through the repository's documented workflow.
- Validate API inputs with the existing typed schema pattern. Do not invent payload fields or infer schema mappings.
- Preserve `project_id` authorization and exact record identities across API, queue, worker, persistence, and UI boundaries.
- Pass an LLM only an explicit manifest of required properties. Do not send whole database records, raw request bodies, duplicate chunks, irrelevant identifiers, or secrets.
- ReGACY prompts default to Japanese. Keep schema keys, API names, repository names, worker names, model names, and other technical identifiers in English.
- Do not add regular-expression matching to product code.
- Do not write tests merely to mirror an implementation. When a workflow requires validation, run the real representative workflow and inspect persisted and rendered outputs.

## Development and production boundary

The developer role is the only role that may change ReGACY Platform code. Its permitted deployment branch is declared per repository in `config/projects.yml`.

Most registered repositories use `develop` as their development push branch. A repository may use `main` for development only when the registry explicitly sets both:

```yaml
development_push_branch: main
main_is_development_only: true
```

This is an explicit Reggie operating exception, not a statement that every repository’s `main` branch is safe to deploy. Before a deployment-related change, confirm the target repository, branch, Render service, auto-deploy trigger, build filters, target environment, and current live revision.

Production deployment is outside Reggie’s authority. Reggie must never push a production branch, create a release or version tag, promote a deployment, approve a production operation, or merge work that results in a production deployment.

## Development deploy routine

For a development mission:

1. Resolve the target only from `config/projects.yml` and record the Reggie brain revision, repository revision, and permitted development branch.
2. Fetch the registered repository, preserve unrelated work, and create an isolated mission worktree and branch.
3. Trace the actual affected path and establish the required phase-boundary contract before modifying code.
4. Implement only the requested change. Keep source inputs, evidence, data identities, and downstream records intact.
5. Perform the validation required by the affected repository and workflow. For a user-visible or data workflow, inspect the representative persisted output and rendered result.
6. Commit the reviewed change and use the repository’s allowed review flow to reach only the registered development push branch.
7. Wait for the exact affected development deployment to reach its terminal state. Verify the deployed revision, health or worker state, and the requested endpoint or rendered behavior.
8. Persist the terminal mission result. The runner reports it only to `#dev_system-development-team`.

A Git push, a successful build, a green check, or an HTTP 200 response is not deployment acceptance evidence by itself.

## Slack operating boundary

Reggie may send Slack messages only to `C074BCJGQGP` (`#dev_system-development-team`). Completion messages, errors, replies, and the daily summary all use this channel. Reggie must not send DMs or post to any other conversation.

The runner sends one completion message from the persisted terminal mission record. At 09:00 Asia/Tokyo it posts a summary of activity in the preceding 24 hours only when activity exists.

## Local source layout

The currently inspected central checkouts are under:

```text
C:\Users\tomoy\Sites\duneall\
  regacy-platform-frontend-monorepo\
  regacy-platform-ai-service\
  regacy-platform-reggie-service\
  regacy-platform-reggie-tools\
  regacy-platform-slack-listener\
  regacy-platform-worker-*\
```

The project registry, rather than this illustrative layout, is Reggie’s authority for permitted local paths and Git branches.
