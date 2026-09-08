# Mission execution policy

The runner updates the Reggie brain repository before every mission and uses the resulting commit SHA for the mission record. A running mission retains the brain revision it started with; later updates apply only to later missions.

Use the selected project's registered upstream branch as the update source. Do not change the registered clone directly. Create an isolated worktree and a mission branch for each mission before modifying code.

If the request does not identify a registered project, record `awaiting_owner_input` with the missing target information. Do not guess a repository from the request text.

Use the project's instructions for validation and release requirements. Report an actual outcome only after the required project-specific evidence has been recorded.
