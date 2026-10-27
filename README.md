# LINE OA Webchat

A webchat for a LINE Official Account, built with Next.js + TypeScript.

**Customers** chat with the OA from the website:
- **Log in with LINE** (via LIFF): the same conversation as their LINE app chat with the OA. Inside the LINE app, messages are sent as the user; in a browser, the OA copies them into the user's LINE chat. Staff replies reach both the website and the LINE app.
- **Temporary username**: no sign-up; replies show on the website only. The same name returns to the same chat.

**Staff** answer everyone from one realtime inbox (`/`), signing in with a username listed in `STAFF_USERNAMES`:
- Messages from the LINE app (webhook) and the website appear live, with each person's LINE name, picture, last message and wait time.
- Pick a person and reply; LINE users get it through the OA (Messaging API push), optionally signed with the agent's name.
- Assign chats to an agent (**All / Mine / Unassigned**); replying to an unassigned chat takes it.
- Pin, mute and delete chats; changes sync to every open tab.

Thai / English UI, keyboard shortcuts, works on mobile.

## How it works

```
LINE user ─► LINE OA ─webhook─► /api/line/webhook ─► Upstash Redis ─► Pusher ─► browsers
staff reply ─► /api/conversations/[id]/messages ─► LINE push API ─► LINE user
web customer ─► /api/me/messages ─► Redis + Pusher (+ OA copy into their LINE chat)
```

| Path | What it does |
|---|---|
| `app/api/line/webhook` | Verifies `x-line-signature` (HMAC-SHA256), stores messages, fetches the LINE profile, notifies browsers |
| `app/api/conversations` | Inbox list, pinned first |
| `app/api/conversations/[id]` | `PATCH` pin / mute / assign, `DELETE` a conversation |
| `app/api/conversations/[id]/messages` | `GET` thread history, `POST` sends a reply |
| `app/api/conversations/[id]/read` | Clears the unread count |
| `app/api/auth/login` | Username login: staff (if in `STAFF_USERNAMES`) or customer guest (signed JWT cookie) |
| `app/api/auth/liff` | LINE login: verifies the LIFF ID token with LINE |
| `app/api/auth/logout` | Signs out and revokes the LINE token |
| `app/api/me`, `app/api/me/messages` | Customer's own identity and thread |
| `app/api/pusher/auth` | Authorizes realtime channels: the inbox for staff, a customer's own thread for customers |
| `app/liff` | Customer chat running inside LINE (LIFF) |
| `lib/store.ts` | Redis storage (in-memory fallback for local dev) |
| `components/` | Inbox, thread, composer, customer chat |

Non-text messages (stickers, photos, files, location…) are shown as labeled placeholders. Follow / block events are shown in the thread, and the composer is disabled for users who blocked the OA.

## Setup

### 1. LINE

1. [LINE Official Account Manager](https://manager.line.biz/) → create an OA → Settings → **Messaging API** → enable it under a provider.
2. Response settings: **Webhooks on**, **Auto-response messages off**.
3. [LINE Developers console](https://developers.line.biz/console/) → the OA's channel → **Basic settings** → Channel secret; **Messaging API** → issue a long-lived channel access token.
4. Optional, for "Log in with LINE": in the **same provider**, create a **LINE Login** channel, link the OA, publish it, and add a **LIFF** app with endpoint `https://<your-app>/liff` and scopes `openid`, `profile`, `chat_message.write`.

### 2. Upstash Redis and Pusher

- Upstash Redis: Vercel project → Storage → Marketplace → Upstash for Redis (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`), or create a database at upstash.com.
- Pusher: create a Channels app at pusher.com → App Keys.

### 3. Environment variables

All secrets come from environment variables only. Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored; never commit real keys. On Vercel, add the same keys under **Project → Settings → Environment Variables**.

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | yes | Long random string, signs the login cookie |
| `LINE_CHANNEL_SECRET` | yes | Verifies webhook signatures |
| `LINE_CHANNEL_ACCESS_TOKEN` | prod | Without it (dev only), replies are logged instead of sent |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | prod | Or `KV_REST_API_URL` / `_TOKEN`. Without them (dev only), data lives in memory |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | no | Without them the inbox polls every 4 seconds |
| `STAFF_USERNAMES` | prod | Comma-separated staff usernames, e.g. `admin,agent1,agent2`. Unset in dev = anyone |
| `NEXT_PUBLIC_SHOW_AGENT_NAME` | no | `true` = replies in LINE start with the agent's name (`agent1: …`) |
| `NEXT_PUBLIC_LINE_OA_URL` | no | Add-friend link shown in the empty inbox and customer chat |
| `LINE_LOGIN_CHANNEL_ID`, `NEXT_PUBLIC_LIFF_ID` | no | Enable "Log in with LINE" |
| `LINE_LOGIN_CHANNEL_SECRET` | no | Lets sign-out revoke the LINE token |

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

1. Vercel → **Add New Project** → import the repo → add the environment variables → Deploy.
2. LINE Developers console → Messaging API → **Webhook URL** = `https://<your-app>/api/line/webhook` → **Verify** → turn on **Use webhook**.
3. Add the OA as a friend, send a message, and reply from the inbox.

## Keyboard

| Key | Action |
|---|---|
| `/` | Search |
| `↑` `↓` or `J` `K` | Move between chats |
| `Enter` | Send · `Shift+Enter` new line |
| `Esc` | Back to the list (mobile) |
