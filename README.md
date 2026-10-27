# LINE OA Webchat

A webchat for a LINE Official Account, built with Next.js + TypeScript. Two sides:

**Customers** chat with the OA from the website (`/chat`):
- **Log in with LINE** (LINE Login): the chat is the same conversation as their LINE app chat with the OA, and staff replies reach both the website and the LINE app.
- **Temporary username**: no sign-up; replies show on the website only. The same name returns to the same chat.

**Staff** answer everyone from the inbox (`/`), signing in with a username listed in `STAFF_USERNAMES`:
- **Receive**: messages sent to the OA from the LINE app (via webhook) and from the website appear live.
- **See who sent it**: each person is listed with their LINE name and picture (or username, marked WEB), last message and how long they have been waiting.
- **Reply**: pick a person, type, press Enter. LINE users get it through the OA (Messaging API push).

Thai / English UI, keyboard shortcuts, works on mobile.

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
| `app/api/auth/login` | Username login: staff (if in `STAFF_USERNAMES`) or customer guest (signed JWT cookie) |
| `app/api/auth/line`, `/callback` | LINE Login (OAuth 2.1 + OpenID Connect) for customers |
| `app/api/me/messages` | Customer's own thread: `GET` history, `POST` sends a message to the OA |
| `app/api/pusher/auth` | Authorizes realtime channels: the inbox for staff, a customer's own thread for customers |
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
| `NEXT_PUBLIC_LINE_OA_URL` | no | Add-friend link shown in the empty inbox and customer chat |
| `STAFF_USERNAMES` | prod | Comma-separated usernames that open the staff inbox. Unset in dev = anyone |
| `LINE_LOGIN_CHANNEL_ID` / `_SECRET` | no | Enables "Log in with LINE". Must be a LINE Login channel under the same provider as the OA |

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
