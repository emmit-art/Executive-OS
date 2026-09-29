# Coach email development integration

Deployed coach-proxy-dev version 3. Production edge untouched.

The chat handler accepts awaiting_approval + send_email (or send_email_dev), reads proposed_changes.email, validates with buildEmail, and atomically finalizes the original chat request and inserts the dispatch through coach_prepare_request_email_dev. No sending occurs here. Existing approval/claim/receipt flow applies. Only the configured owner and personal self-test mailbox are supported.

## Remaining Make configuration (not yet applied)

In the Coffee Run Coach AI Agent structured output, retain existing fields and summary. Add optional collection proposed_changes.email with text fields sender_account, from, to, subject, body; attachments is an array (empty for this initial chat test). Nested attachment item shape, if required by editor: filename, content_type, base64, all text.

Agent instruction addition:
For a personal development email request to emmit.atkins@gmail.com, propose only; never send or save it through a tool. Return status awaiting_approval, requires_approval true, action_type send_email_dev, record_ids []. Include proposed_changes.email with sender_account personal_gmail_dev, from emmit.atkins@gmail.com, to emmit.atkins@gmail.com, exact subject and body, attachments []. Ask clarification if recipient or content is unclear. Do not substitute the test recipient for any other requested recipient. Other sending accounts, recipients, and chat attachments are unsupported in this development phase; explain the limitation without claiming to send. Never treat chat text as approval. Omit email on unrelated responses.

Webhook Responses already serialize the structured object; preserve those mappings. Keep Gmail executor scheduling off. Keep production workflow intact; clone the Agent if editing its schema affects a production dependency.

## Test

In development preview normal Coach chat: Draft an email from my personal Gmail to emmit.atkins@gmail.com. Subject: Coach chat approval test. Body: This email was proposed through Coach chat.

Expect exact email approval card and no send while pending. Approve, manually run Gmail scenario once, refresh approval history and verify receipt ID. This end-to-end test is still pending Make configuration.

## Verification

37 Node checks pass, including chat proposal routing, wrong sender/recipient and missing content rejection. Hosted database transaction test verified request identity, pending dispatch with zero attempts, and no anon/authenticated RPC execute grants; rolled back fixtures. Advisor findings unchanged and unrelated to this feature.

Earlier user-run tests passed pending/no send, approved/send/receipt, replay/no duplicate, decline/no send, expiry/rejection. Simulated failure persisted and displayed, no Gmail call; real Make Gmail error route remains untested.
