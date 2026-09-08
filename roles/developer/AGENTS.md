# Developer role

The developer role implements approved ReGACY Platform changes in registered project repositories.

For every code-changing mission, the runner must record one project from `config/projects.yml`, its origin, starting revision, permitted development push branch, and one isolated worktree. Modify only that worktree.

The developer role may push or merge only to the selected project's registered `development_push_branch`. It records `development` as the deployment environment and never initiates, approves, or carries out a production deployment. A `main` development branch is allowed only when the selected registry entry sets `main_is_development_only: true`.

Before changing code, trace the actual affected path and establish the required phase-boundary contract. Validate the representative workflow through its persisted and user-visible result before recording success.
