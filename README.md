# CivicAlert — Full MERN Application (Source Code)

A hyperlocal, crowdsourced civic-hazard reporting application, with a **citizen-facing React app**, a **separate React admin dashboard**, and a **shared Node.js / Express / MongoDB API**.

**This is a working codebase / integration-ready MVP, not a preconfigured hosted service.** You must provide your own MongoDB connection, Google OAuth client ID, ImageKit key, and the credentials for any external notification channels you enable. Source code is included; `node_modules`, secrets, external accounts, and production infrastructure are deliberately excluded. Some integrations cannot function before credentials are supplied.

## Features included in source

- React + Vite + Tailwind frontend, responsive mobile layout, landing, explore map, incident details, Google sign-in, report form, report history, profile, notification center.
- Leaflet + OpenStreetMap map with live backend incident markers, geolocation gate, radius + category filters.
- Express + Mongoose API with JWT-protected cookie sessions and Google ID-token verification.
- Incident image upload to ImageKit; MongoDB stores image URL and file ID, not file bytes.
- AI advisory categorization with Gemini API (optional); on unavailable/failed AI, the report is published **Unverified with a warning**.
- Duplicate *suggestions* using geospatial proximity and text similarity; these do not block submission.
- Community Yes/No votes: authenticated, non-reporting users with a recent GPS fix received within 2 minutes, within 1 km of the incident. **At least 5 Yes and ≥75% Yes** to show `Community verified`. A later No vote can revoke that status.
- Citizen report editing (resets community votes) and soft deletion that removes public content and retains minimal audit metadata. Images are deleted on a best-effort basis; failed cloud cleanup needs manual remediation.
- In-app notifications (MongoDB + Socket.IO), SMTP email, Telegram Bot, optional browser push (Web Push/VAPID).
- Separate admin website: login, main/sub-admin accounts and permissions, moderation, citizen suspension, authority contact directory, AI-drafted authority emails requiring explicit human approval.
- MongoDB-derived stats, basic security middleware, validation, and Node unit tests.

## Requirements

- Node.js **20.19+** (Node 22 LTS recommended), npm
- MongoDB Community server running locally, or MongoDB Atlas connection string
- A modern browser, HTTPS or localhost for browser geolocation and Web Push
- Google Cloud OAuth web client for citizen sign-in
- ImageKit server-to-server private API key for new incident submissions
- Optional: Gemini API key, SMTP credentials, Telegram bot token/webhook, VAPID keys

### 1. Install dependencies

Open a terminal in the root folder (the folder containing this README).

```powershell
npm install
```

The root project uses npm workspaces, so **one install** sets up `client`, `admin` and `server`.

### 2. Configure environment

Copy the example `.env` files:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
Copy-Item admin/.env.example admin/.env
```

On macOS/Linux, use `cp` instead of `Copy-Item`.

Edit the files. **Never push `.env` to GitHub.**

- `server/.env`: set `MONGODB_URI` (e.g. `mongodb://127.0.0.1:27017/civicalert`) and a long, random, 32+ character `JWT_SECRET`.
- `client/.env` and `server/.env`: use the **same** Google OAuth Web client ID in `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`.
- In Google Cloud OAuth configuration, add `http://localhost:5173` to **Authorized JavaScript origins**. The Google Identity Services credential flow in this code uses ID tokens, not authorization-code redirects.
- `server/.env`: set `IMAGEKIT_PRIVATE_KEY` from your ImageKit dashboard. This is server-only, never a `VITE_` variable.
- `GEMINI_API_KEY` is optional. If absent, AI returns a warning and reporting still works. The default model name is only an example; change `GEMINI_MODEL` to one currently accessible to your account if necessary.
- `admin/.env`: `VITE_API_URL=http://localhost:4000` (already shown in the example).

**The map displays with public OpenStreetMap tiles only subject to OSM's public tile usage policy.** There is no unrestricted, free production tile-hosting guarantee. The default tile URL must be replaced with a compliant provider or self-hosted tiles at scale. OpenStreetMap attribution is included.

### 3. Initialize the main admin exactly once

`server/.env` must have a working MongoDB URI. In a PowerShell terminal (from the project root):

```powershell
$env:MAIN_ADMIN_USERNAME="civicalertroot"
$env:MAIN_ADMIN_PASSWORD="CHOOSE_A_LONG_RANDOM_14_PLUS_CHAR_PASSWORD"
npm run seed:admin
Remove-Item Env:MAIN_ADMIN_USERNAME
Remove-Item Env:MAIN_ADMIN_PASSWORD
```

Use your **own** strong values. The script refuses to overwrite an existing main admin. The username cannot be changed through the admin API; the password **can** be changed in the admin UI via the backend. There is intentionally **no public password-reset form**.

If access is lost, an operator with direct secure database access can use `node server/scripts/recoverAdmin.js` with `RECOVER_MAIN_ADMIN=I_HAVE_VERIFIED_DATABASE_ACCESS`, `NEW_MAIN_ADMIN_PASSWORD`, and a configured MongoDB URI. Do not run that script on an untrusted computer.

### 4. Run all three applications

```powershell
npm run dev
```

- **Citizen website:** http://localhost:5173
- **Admin website:** http://localhost:5174
- **Backend health:** http://localhost:4000/api/health

The API connects to MongoDB before listening, and fails explicitly if database/JWT settings are missing.

### 5. Test

```powershell
npm test
npm run build
```

Tests cover verification thresholds, proximity and duplicate text similarity. The project currently lacks full integration/e2e tests that require live MongoDB and external providers. Test all important flows before public deployment.

## Optional notification configuration

**Email:** Supply `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `server/.env`. Your SMTP account's limits and terms apply. Email notification requests are best-effort.

**Telegram:** Create your own bot with @BotFather, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET`. Users connect by visiting a short-lived bot deep link generated in the citizen Notifications page, then pressing Start. For remote delivery set Telegram webhook to `https://YOUR_API_HOST/api/notifications/telegram/webhook` with the secret token header, using the Telegram Bot API's `setWebhook` action. Localhost is not publicly reachable by Telegram; use a safe HTTPS development tunnel if testing webhooks locally.

**Browser push:** Generate a VAPID keypair using `npx web-push generate-vapid-keys` (after npm install). Set server `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, and client `VITE_VAPID_PUBLIC_KEY` (the matching public key). Browser requires user-granted notification permission and secure context. Service worker lives in `client/public/sw.js`.

**In-app:** Stores notifications in MongoDB and delivers live Socket.IO messages when users are connected. Recipients are registered users, other than the reporter, who have a server-recorded location no older than 2 minutes and within 1,000 m.

**Important real-world limitation:** A website can't continually obtain GPS coordinates after the browser/app is closed. Users without recent recorded GPS positions **will not** be targeted for live 1-km requests. Background locality subscriptions are not yet implemented. Browser GPS can be spoofed; additional verification controls are needed for public rollout.

## Admin permissions and authority mail

The first admin is a `main` administrator; only main may create/disable/reset `sub` admins. Sub-admins must change their assigned temporary password on first login. Backend authorization checks permissions, independent of the frontend.

An admin saves independently confirmed authority email addresses in the directory. AI may produce an email draft; if AI isn't configured, a clearly structured non-AI fallback draft is generated. **No authority email is sent automatically.** A permitted admin must explicitly approve the subject and body and click Send. Sending is blocked if the selected contact is not flagged as independently verified.

Authorities do **not** have accounts or dashboards in this version. Blood donation functionality is not included.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Server status |
| POST | `/api/auth/google` | Verify Google credential and create a citizen session |
| GET | `/api/auth/me` | Current citizen |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/location` | Save a recent, accuracy-checked location for registered citizen |
| PATCH | `/api/auth/preferences` | Notification preferences |
| GET | `/api/incidents?lat=&lng=&radius=` | Public incidents near supplied coordinates |
| GET | `/api/incidents/:id` | Public incident details |
| POST | `/api/incidents` | Signed-in citizen: multipart photo + description + lat + lng |
| GET | `/api/incidents/mine` | Own reports |
| PATCH | `/api/incidents/:id` | Edit own report; resets votes |
| DELETE | `/api/incidents/:id` | Soft delete own report; scrub content |
| POST | `/api/incidents/:id/vote` | Yes/No with recent location, 1-km check |
| GET | `/api/notifications` | User notifications |
| PATCH | `/api/notifications/read-all` | Read all |
| POST | `/api/notifications/push/subscribe` | Save push subscription |
| POST | `/api/notifications/telegram/link` | Generate Telegram deep link |
| POST | `/api/notifications/telegram/webhook` | Secured Telegram bot callback |
| POST | `/api/admin/login` | Admin authentication |
| GET | `/api/admin/me` | Current admin |
| GET | `/api/admin/stats` | MongoDB-derived dashboard metrics |
| GET / PATCH | `/api/admin/incidents` / `/api/admin/incidents/:id/moderate` | Moderate reports |
| GET / PATCH | `/api/admin/users` / `/api/admin/users/:id` | Manage citizen account state |
| GET / POST / PATCH | `/api/admin/contacts` / `/api/admin/contacts/:id` | Manage verified authority contacts |
| POST | `/api/admin/incidents/:id/draft` | Generate an authority email draft |
| POST | `/api/admin/incidents/:id/send` | Explicitly send admin-approved email |
| GET / POST / PATCH | `/api/admin/subadmins` / `/api/admin/subadmins/:id` | Manage sub-admin accounts |

## Current MVP limitations and production hardening checklist

- [ ] Configure credentials and run local full-stack testing.
- [ ] Add automated browser e2e and MongoDB integration tests.
- [ ] Use a durable async job queue for image AI processing, ImageKit deletion retries, and multi-channel notification retries. Current work is synchronous / best-effort.
- [ ] Add stronger file verification (magic bytes), malware scanning, abuse moderation, and location privacy review.
- [ ] Add location-attestation / fraud detection; browser-provided GPS is not tamper-proof.
- [ ] Consider community quorum aging and coordinated fake account detection (current vote threshold is numerical).
- [ ] Add CSRF tokens or tighter per-deployment cookie/origin controls, HTTPS, secure infrastructure, backups, structured logging and monitoring.
- [ ] Restrict admin access at the network/proxy layer and add 2FA (especially to the main admin).
- [ ] Process scheduled stale-report expiry and scalable notification dispatch.
- [ ] Revisit OSM tile usage policy and select a production-capable tile source.
- [ ] Verify any current API model names, hosting quotas, and provider terms before deploying.
- [ ] Add a public privacy policy, retention controls, and citizen data export/deletion flow.
- [ ] Add subscribed localities for offline notifications; current implementation targets recent GPS only.

See `docs/ARCHITECTURE.md` for the data flow and `docs/LEARNING_GUIDE.md` for a recommended reading order.
