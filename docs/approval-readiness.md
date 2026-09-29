# Approval workflow readiness — 2026-09-23

## Current state

Development implementation is published and hosted approval UI verification passed. It is **not ready for production promotion or external action execution**.

- Branch: `make-coach-integration`; draft PR: https://github.com/emmit-art/Executive-OS/pull/2
- New `coach-proxy-dev` is deployed. Existing `coach-proxy` is unchanged.
- Additive `durable_coach_approvals` database migration is applied. SQL source is `supabase/schema/durable_approvals.sql`.
- User explicitly authorized publication. The connected GitHub app published commit `5fbfc308cd4ba7e65756a63509f5494f98ec9a46`; its tree matches local commit `9afd00f` exactly. Both Vercel preview checks succeeded. Command-line Git had no credentials. Production was not merged or promoted.
- Make scenario 6366774 has a saved status router after Agent 1: completed → Response 11; needs_clarification → Response 13; awaiting_approval → Response 14; fallback failed_or_invalid → Response 15. The fallback preserves the response; the development proxy rejects malformed/unknown contracts.

## What is implemented

Proposals store their exact text, structured changes, action type, owner, request/thread IDs, SHA-256 snapshot hash, expiry, decision and execution result. Owner-only read policies and server-only writes protect the action and audit tables. Decisions verify the authenticated owner and submitted snapshot hash. A transaction locks the action; subsequent decisions return its saved result, including opposing decisions after completion.

The UI uses an explicit decision endpoint, disables pending controls and offers approval history. The old conversational approval helper is removed. Failed transport or persistence never becomes a successful completion. Timeouts warn that the outcome may be unknown and do not automatically retry.

Only local, side-effect-free success/failure diagnostic executors exist. Approving email, calendar, financial or other unsupported actions records approval with execution blocked and zero attempts. The action cannot silently execute later after an executor is connected; a new proposal is required.

## Verification

| Check | Result |
| --- | --- |
| Node contract/handler tests | 23 passed |
| Real database assertions | Passed: owner isolation, stale hash, approve, decline, replay, expiry, unsupported executor, controlled failure, grants and authenticated RLS |
| Database test cleanup | Transaction fixtures rolled back |
| Simultaneous approve calls | One fresh decision, one idempotent replay; attempts=1; three audit events |
| Concurrent diagnostic fixture | Retained, request `ea0cd8c6-9f84-4faf-8c44-9db3a82d7608`; no external effects |
| Development endpoint without auth | HTTP 401 |
| Make completed replay | Correct route; JSON with quotes, emoji and newline retained |
| Make proposal-only replay | awaiting_approval route selected; other routes rejected |
| Make clarification replay | needs_clarification route selected; other routes rejected |
| Controlled failed-status prompt | Preview displayed failure; request f3f7c951-f969-4330-b0f7-c05e1c88f3f1 persisted as failed, requires_approval=false |
| Executive object count after route tests | Unchanged at 2 |
| Hosted new approval UI | Passed: reload persistence, approval success, decline with zero attempts, controlled failure feedback, database result verification |

## Remaining release gates

1. Development publication and hosted preview checks are complete.
2. Database duplicate and concurrent decision tests passed; successful UI approval records show one attempt, declined records zero attempts.
3. Before real external execution: implement a typed executor with complete machine-readable proposal fields (recipient/subject/body or event details), provider idempotency, durable dispatch/reconciliation and sandbox integration tests. A Make summary alone is not a sufficient executable payload.
4. Review the existing agent record-write tool boundaries and database security findings before promotion. Contract validation after a tool call cannot undo an earlier write.
5. Separate explicit production merge/deployment approval.

## Existing security findings

No new approval-table or approval-RPC advisor findings were reported. Existing findings elsewhere in the project remain unchanged: anonymous/authenticated execution of `invoke_coffee_run_push_dispatch` and `materialize_due_recurring_automations` SECURITY DEFINER functions; mutable search paths on existing functions; disabled leaked-password protection; and app_server_config RLS without a policy (informational).

Review these separately rather than changing unrelated policies during this integration:

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Recovery

Keep production `coach-proxy` and the production frontend unchanged. The original proxy source is retained under `supabase/functions/coach-proxy-dev/previous-coach-proxy.ts`. If a development rollback is needed, revert the frontend branch to its prior endpoint and preserve approval/audit records; no destructive database rollback is required. Do not delete user records or audit history.
