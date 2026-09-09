# Slack reporting policy

For a mission, post the outbound Slack message only to its triggering channel and thread. Do not post to a direct message or an unrelated channel, private channel, group conversation, or thread.

## Reactive mission trigger

Process only newly delivered Slack `app_mention` events in channels where the installed Reggie bot is present. Do not poll, crawl, search, or replay Slack history to find requests. Record the matched mention and message identity before starting the mission.

## Completion message

After a mission reaches `succeeded`, `failed`, `cancelled`, or `awaiting_owner_input`, the runner sends one reply in the triggering Slack thread, using the triggering message's language.

The message includes the mission ID, request summary, terminal status, result or blocker, Reggie brain commit SHA, target repository, branch, changed-file list, and Git commit, pull request, or deployment reference when present. It also states the next action required from the owner when the status requires one.

Do not send a completion message for intermediate progress.

## Daily summary

At 09:00 Asia/Tokyo every day, the runner queries persisted mission records for activity during the prior 24 hours and sends one message to a separately configured reporting channel when at least one mission had activity.

The summary includes counts for succeeded, failed, cancelled, and awaiting-owner-input missions. For each mission, include the request, outcome or blocker, and GitHub or deployment reference when present. End with unresolved blockers and required owner actions. Do not send a daily summary when there was no activity in the period.
