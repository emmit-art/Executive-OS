# Coffee Run calendar development executor

The development Coach proxy accepts a proposal-only calendar response with:

```json
{
  "status": "awaiting_approval",
  "reply": "Review the exact calendar event below. It will only be created after approval.",
  "requires_approval": true,
  "action_type": "create_calendar_event_dev",
  "proposed_changes": {
    "calendar": {
      "calendar_account": "personal_icloud_family",
      "title": "...",
      "start_at": "2026-09-25T09:00:00-04:00",
      "end_at": "2026-09-25T09:30:00-04:00",
      "timezone": "America/New_York",
      "location": "",
      "notes": "",
      "all_day": false
    }
  },
  "record_ids": []
}
```

The development executor targets the connected iPhone's **default** calendar; the phone must keep Family Calendar selected as its default. The `calendar_account` value is an allowlist label, not an Apple calendar ID. It freezes the exact event before approval, rejects expired or declined actions, and claims each approved action once before contacting Apple. An uncertain Apple/Make result is not automatically retried; verify the iPhone calendar first.

This version supports timed events (`all_day: false`) with title, start, end, and location. The Apple iOS module has no Notes input; nonempty notes and all-day proposals are rejected rather than silently changed. Timestamps need an explicit offset. The preview form converts Eastern wall-clock input to UTC and rejects daylight-saving gaps and overlaps.

## Saved Make scenario

Scenario 6388946, **Coffee Run Family Calendar Executor Dev**, remains inactive.

| Module | Configuration |
| --- | --- |
| Supabase 1 | POST `/rest/v1/rpc/coach_claim_calendar_dev`; JSON body `{}` |
| Filter | `Approved calendar only`; `1.body.claimed`; Boolean **Is true** |
| Apple iOS 3 | Device `Emmit iPhone – Coffee Run DEV`; title/start/end/location from `1.body.payload`; All day No |
| Supabase 4, success route | POST `/rest/v1/rpc/coach_finish_calendar_dev`; action and claim from module 1; empty event ID; result below |
| Supabase 5, Apple error route | POST `/rest/v1/rpc/coach_calendar_error_dev`; action and claim from module 1; explicit unconfirmed-outcome error |
| Commit 6 | Stop after recording the Apple error; do not process success route |

All Supabase modules use Content-Type `application/json`. Store incomplete executions is No. No retry handler is configured.

The success receipt is deliberately a device submission, not a claim that iCloud created the event:

```json
{"outcome":"submitted_to_device","provider":"apple_ios","device":"Emmit iPhone – Coffee Run DEV","confirmation_required":true}
```

`coach_finish_calendar_dev` records this receipt while retaining `outcome_unknown` and a consumed claim. A confirmed provider ID is required for the separate `created` state. No invented event IDs or automatic resend are allowed. The authenticated owner can use Confirm seen in Family Calendar after checking the phone; this records user confirmation without inventing a provider event ID.

## Verification checkpoint — September 28, 2026

- Recovered and saved both result-recording modules. Added and saved Commit on the error route.
- Verified claim endpoint/body, mapped Apple fields, Boolean filter, finish/error bodies, and disabled incomplete execution retries.
- One Make no-op run completed: claim ran, zero bundles passed the filter, no Apple module ran.
- Transaction-only SQL tests passed for ownership/hash binding, pending/declined/expired rejection, single claim, receipt replay, null/wrong claim rejection, and no automatic retry after uncertain submission or error. Synthetic rows rolled back.
- September 29 UTC: applied `calendar_payload_limits_dev` and deployed `coach-proxy-dev` version 5 with JWT verification retained. Backend rejects notes, all-day events, and timestamps without an offset. Updated SQL guard tests passed and rolled back all fixtures.
- Node verification: 40 calendar, Coach, and email tests passed, including Eastern summer/winter conversion and invalid or ambiguous local times.
- Supabase advisors: no security finding on the calendar objects. An informational [missing owner foreign-key index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) is deferred for this single-user development queue. Unrelated existing push/recurrence function access and search-path warnings, password-protection settings, and broader performance findings were not changed in this milestone; review them before production rollout.
- No live approval-gated event has run yet. Next: prepare one timed proposal, have Emmit review and approve it, run the executor once, then sync Make on the iPhone and verify exactly one event in Family Calendar.

## Hosted preview checkpoint

- Preview branch published at `0ce65727f9a77bb423d8765e361552e43d1e9710`; Vercel checks succeeded. Production branch and draft PR remain unchanged.
- Signed-in preview successfully prepared one pending proposal through `coach-proxy-dev`: Coffee Run calendar approval test 001, September 29, 2026, noon to 12:15 p.m. Eastern; stored timestamps 16:00–16:15 UTC. No location or notes; timed event.
- Approval card displays Eastern dates with the zone; exact frozen JSON remains expandable. Do not prepare another proposal or run Make until Emmit reviews this one. After approval, run scenario 6388946 once, then ask Emmit to sync the Make app and verify exactly one Family Calendar event.

## Completed September 28 evening

- Make ran the approved test once at 22:33 Eastern, saved submitted_to_device, attempts=1. Emmit confirmed it appeared in Family Calendar at 22:37.
- Added service-only owner-bound `coach_confirm_calendar_dev`, dev proxy operation, and the approval-card confirmation button. Deployed dev proxy v6 with JWT verification retained. Verified wrong-owner and premature rejection, idempotent replay, and unchanged send attempt count. All 42 Node tests passed.
- Used the hosted confirmation button to record Emmit’s report. Action `5e2be83f-f69b-4c62-b447-d89683f9e1a0` is now succeeded, with confirmation_source=user and no fabricated provider ID. Confirmation is historical even if Emmit deletes the test event.
- Normal AI chat test passed through the Make agent and produced a frozen calendar approval: Coffee Run chat calendar test, September 30, 2026, 12:00–12:15 Eastern, no notes or location. It remains pending and has not been dispatched. Do not approve or run it without Emmit’s explicit request.
- Calendar scenario remains inactive. Next milestone: specialist-agent integration and combined Chief of Staff briefings; keep development branch isolated.
