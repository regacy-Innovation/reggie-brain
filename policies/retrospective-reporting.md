# Retrospective reporting policy

Create daily, weekly, and monthly reports from Reggie's own persisted work in the completed period. Use Asia/Tokyo dates.

- Daily: the preceding 24 hours.
- Weekly: the preceding completed Monday-through-Sunday period.
- Monthly: the preceding completed calendar month.

On the first scheduled agent check after a period closes, create that period's report if it does not already exist. Do not create a second report for the same period.

For every report, read the completed period's mission bundles, requester evaluations, Slack delivery state, and recorded artifact or pull-request references. Also review the prior retrospective reports and their cited evidence for unresolved improvements, recurring issues, and previously claimed progress. Do not rely on agent memory or Slack history beyond the evidence retained with those records.

Use these sections exactly:

1. `What worked well`
2. `What did not work`
3. `Improvements to better serve the user`
4. `Progress and recurring issues`

List the supporting mission IDs and prior report references in every section. Make improvement proposals specific to observed outcomes, feedback, or evidence gaps. In `Progress and recurring issues`, compare each unresolved improvement from prior reports against later evidence and mark it as completed, showing progress, unchanged, or recurring. Identify every issue that repeats across reporting periods and state its recurrence evidence. Do not claim that Reggie is improving unless later mission outcomes or requester feedback demonstrate it. Do not silently change Reggie's instructions, role profiles, or runtime configuration based on a retrospective; submit any such change as a separate, reviewable proposal.

Commit and push the report before announcing it in the configured reporting channel. When no mission activity occurred, write that fact without inventing findings.
