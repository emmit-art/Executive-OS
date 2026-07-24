# Executive OS

Executive OS is Emmit's private personal command center for managing priorities, follow-ups, companies, knowledge, goals, calendar information, and AI-assisted capture.

## Current release

Version **1.2.1** adds calendar synchronization controls:

- automatic calendar sync after sign-in
- a 15-minute automatic-sync throttle
- manual **Refresh** synchronization
- calendar synchronization status messages
- loading today's events from `calendar_events_cache`

## Architecture

This release is a lightweight static web application:

- `index.html` — complete frontend application
- `vercel.json` — Vercel static-site routing preferences
- Supabase — authentication, application data, calendar cache, and the `sync-calendars` Edge Function

## Local setup

No build step is required. Serve the project directory with any static file server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Supabase configuration

The frontend uses the Executive OS Supabase project and a browser-safe publishable key. A Supabase service-role key must never be placed in this repository or exposed to the browser.

Required backend resources include:

- authentication
- `workspaces`
- `tasks`
- `waiting_on`
- `notes`
- `daily_focus`
- `assistant_captures`
- `calendar_sources`
- `calendar_events_cache`
- the deployed `sync-calendars` Edge Function

## Calendar security

The private published iCloud calendar URL must be stored only in a protected server-side location, such as a secured Supabase table or Edge Function secret. Do not put it in frontend code, GitHub, Vercel public environment variables, logs, or documentation.

## Deployment

The repository is intended to deploy through Vercel from the default branch. Vercel should treat the repository as a static site with no build command and serve `index.html` from the repository root.
