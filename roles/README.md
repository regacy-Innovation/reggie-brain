# Reggie roles

`REGGIE_ROLE` is a local runner environment variable. Its value must match exactly one `id` in `config/roles.yml`. The runner must reject an unset, unknown, or ambiguous value; it must not choose a default role.

For every mission, the runner reads the shared root `AGENTS.md`, all applicable shared contracts and policies, and the selected role's `AGENTS.md`. It records the role ID and instruction path with the Reggie brain commit SHA.

Role instructions are versioned in this repository. Keep only role selection and role-specific credentials or service endpoints in the local runner environment; do not duplicate instructions in `.env` files.

Use short-lived Git branches to change a role or shared rule, then merge the reviewed change into `main`. Do not keep one long-lived Git branch per role.
