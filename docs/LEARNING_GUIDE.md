# How to learn CivicAlert from its source

This project is organized so you can trace a feature all the way from React to MongoDB.

## Follow this order

1. `client/src/main.jsx` — understand React root, Router, and context providers.
2. `client/src/App.jsx` — see which pages map to which URL.
3. `client/src/pages/Home.jsx` and `client/src/components/Shell.jsx` — JSX and reusable components.
4. `client/src/contexts/LocationContext.jsx` — browser GPS and why consent/accuracy matter.
5. `client/src/lib/api.js` — all frontend HTTP requests pass through this helper.
6. `server/server.js` → `server/src/app.js` — start the API, connect MongoDB, mount routes.
7. `server/src/models/index.js` — MongoDB schemas and relationships.
8. `server/src/routes/auth.js` — how server verifies Google sign-in and location updates.
9. `client/src/pages/Report.jsx` + `server/src/routes/incidents.js` — multipart form, validation, ImageKit, Gemini, MongoDB.
10. `client/src/pages/IncidentDetails.jsx` + the vote route — one person/incident and GPS proximity.
11. `server/src/services/notify.js` + `client/src/pages/Notifications.jsx` — multi-channel notifications.
12. `admin/src/App.jsx` + `server/src/routes/admin.js` — admin role checks, moderation, mail approvals.

## Suggested study exercises

- Change the card layout in `IncidentCard.jsx` without touching the backend.
- Add a 'critical' severity-only filter to Explore; trace it to the API query.
- Make a report and check the document directly in MongoDB Compass.
- Call `GET /api/incidents` without GPS coordinates; inspect the error.
- Write extra tests for `votingResult(9,3)` and `votingResult(5,4)`.
- Add a migration or script to clean up ImageKit files when a deletion retry is needed.

## Real vs simulated

The implementation does not ship with fabricated incidents or fake dashboard counters. If the database is empty, the UI shows an empty state. When an API isn't configured, the UI/backend shows an explicit error or unavailable-service warning. The Telegram, Google, ImageKit, SMTP, Gemini and Web Push integrations need your credentials to be functional.
