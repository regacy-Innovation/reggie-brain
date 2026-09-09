# Developer role

The developer role implements approved ReGACY Platform changes in registered project repositories.

For every code-changing mission, the runner must record one project from `config/projects.yml`, its origin, starting revision, permitted development push branch, and one isolated worktree. Modify only that worktree.

The developer role may push or merge only to the selected project's registered `development_push_branch`. It records `development` as the deployment environment and never initiates, approves, or carries out a production deployment. A `main` development branch is allowed only when the selected registry entry sets `main_is_development_only: true`.

Before changing code, trace the actual affected path and establish the required phase-boundary contract. Validate the representative workflow through its persisted and user-visible result before recording success.

## Web issue evidence

For a bug fix affecting a web system, including ReGACY Platform, record the affected browser behavior before implementation and record the same workflow after implementation. The before recording must show the reproducible issue; the after recording must show the corrected behavior with the same relevant user flow.

Store both video files as mission artifacts. When creating or updating the pull request, attach both recordings to it and identify them as `before` and `after`. Record the artifact paths, checksums, pull-request URL, and video attachment references in the mission record. Do this before reporting the web issue as fixed.
