# LINE OA Webchat

A web inbox for a LINE Official Account, built with Next.js + TypeScript.

- **Receive**: messages LINE users send to the OA arrive through the LINE webhook and appear live.
- **See who sent it**: each LINE user is listed with their LINE display name, picture, last message and how long they have been waiting.
- **Reply**: pick a user, type, press Enter. The reply is sent through the OA (Messaging API push), so the user gets it in the LINE app.
- Username-only sign-in, Thai / English UI, keyboard shortcuts, works on mobile.

## Submission

| | URL |
|---|---|
| LINE OA (add friend) | `https://line.me/R/ti/p/@<your-oa-id>` |
| Webchat | `https://<your-app>.vercel.app` |
| GitHub | `https://github.com/<you>/line-webchat` |

## How it works

```
LINE user ─► LINE OA ─webhook─► /api/line/webhook ─► Upstash Redis ─► Pusher ─► webchat (browser)
webchat reply ─► /api/conversations/[userId]/messages ─► LINE push API ─► LINE user
```

| Path | What it does |
|---|---|
| `app/api/line/webhook` | Verifies `x-line-signature` (HMAC-SHA256), stores messages, fetches the LINE profile, notifies browsers |
| `app/api/conversations` | Lists LINE users, newest first |
| `app/api/conversations/[userId]/messages` | `GET` thread history, `POST` sends a reply through the OA |
| `app/api/conversations/[userId]/read` | Clears the unread count |
| `app/api/auth/*` | Username-only login (signed JWT cookie) |
| `app/api/pusher/auth` | Authorizes the private realtime channel for logged-in agents |
| `lib/store.ts` | Redis storage (in-memory fallback for local dev) |
| `components/` | Inbox UI: conversation board, thread, composer |

Non-text messages (stickers, photos, files, location…) are shown as labeled placeholders. Follow / block events are shown in the thread, and the composer is disabled for users who blocked the OA.

## Setup

### 1. LINE

1. [LINE Developers console](https://developers.line.biz/console/) → create a provider → create a **Messaging API** channel (this creates the OA).
2. **Basic settings** → copy **Channel secret**.
3. **Messaging API** → issue a **Channel access token (long-lived)**.
4. [LINE Official Account Manager](https://manager.line.biz/) → Settings → Response settings: turn **Webhooks on**, **Auto-reply messages off**, **Greeting message off** (optional).
5. The add-friend URL / QR code is on the Messaging API tab.

### 2. Upstash Redis and Pusher

- Upstash Redis: Vercel project → Storage → Marketplace → Upstash for Redis (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`), or create a database at upstash.com.
- Pusher: create a Channels app at pusher.com → App Keys.

### 3. Environment variables

All secrets come from environment variables only. Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored; the repo is public, so never commit real keys. On Vercel, add the same keys under **Project → Settings → Environment Variables**.

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | yes | Long random string, signs the login cookie |
| `LINE_CHANNEL_SECRET` | yes | Verifies webhook signatures |
| `LINE_CHANNEL_ACCESS_TOKEN` | prod | Without it (dev only), replies are logged instead of sent |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | prod | Or `KV_REST_API_URL` / `_TOKEN`. Without them (dev only), data lives in memory |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | no | Without them the inbox polls every 4 seconds |
| `NEXT_PUBLIC_LINE_OA_URL` | no | Add-friend link shown in the empty inbox |

### 4. Run locally

```bash
npm install
npm run dev
```

Simulate a LINE user without a phone (uses the same `LINE_CHANNEL_SECRET` as the server):

```bash
LINE_CHANNEL_SECRET=... node scripts/simulate-webhook.mjs http://localhost:3000/api/line/webhook
```

### 5. Deploy

1. Push this repo to GitHub (public).
2. Vercel → **Add New Project** → import the repo → add the environment variables → Deploy.
3. LINE Developers console → Messaging API → **Webhook URL** = `https://<your-app>.vercel.app/api/line/webhook` → **Verify** → turn on **Use webhook**.
4. Add the OA as a friend on your phone, send a message, and reply from the webchat.

## Keyboard

| Key | Action |
|---|---|
| `/` | Search |
| `↑` `↓` or `J` `K` | Move between users |
| `Enter` | Send · `Shift+Enter` new line |
| `Esc` | Back to the list (mobile) |
