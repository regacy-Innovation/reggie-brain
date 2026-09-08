# Mission execution policy

The runner updates the Reggie brain repository before every mission and uses the resulting commit SHA for the mission record. A running mission retains the brain revision it started with; later updates apply only to later missions.

Only the developer role may modify project code. For that role, use the selected project's registered upstream branch as the update source. Do not change the registered clone directly. Create an isolated worktree and a mission branch for each mission before modifying code.

The developer role may push or merge work only to the selected project's registered `development_push_branch`. It must record `development` as the deployment environment and must never initiate, approve, or carry out a production deployment. A `main` development branch is allowed only when the project registry explicitly marks it `main_is_development_only: true`.

For a developer-role mission, if the request does not identify a registered project, record `awaiting_owner_input` with the missing target information. Do not guess a repository from the request text.

For a developer-role mission, use the project's instructions for validation and release requirements. Report an actual outcome only after the required project-specific evidence has been recorded.
