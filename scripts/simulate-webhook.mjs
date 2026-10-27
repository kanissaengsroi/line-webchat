// Sends a signed fake LINE webhook event to a running server, for local testing.
// Usage: LINE_CHANNEL_SECRET=... node scripts/simulate-webhook.mjs [url] [userId] [text] [type]
import crypto from "node:crypto";

const url = process.argv[2] ?? "http://localhost:3000/api/line/webhook";
const userId = process.argv[3] ?? "U" + crypto.randomBytes(16).toString("hex");
const text = process.argv[4] ?? "สวัสดีครับ สอบถามเรื่องสินค้าหน่อยครับ";
const type = process.argv[5] ?? "text";
const secret = process.env.LINE_CHANNEL_SECRET;
if (!secret) throw new Error("Set LINE_CHANNEL_SECRET to the same value the server uses.");

const message =
  type === "text"
    ? { id: String(Date.now()), type: "text", text }
    : { id: String(Date.now()), type, packageId: "1", stickerId: "1" };

const body = JSON.stringify({
  destination: "Utest",
  events: [
    {
      type: "message",
      timestamp: Date.now(),
      source: { type: "user", userId },
      webhookEventId: crypto.randomUUID(),
      replyToken: "test",
      mode: "active",
      message,
    },
  ],
});
const signature = crypto.createHmac("sha256", secret).update(body).digest("base64");
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-line-signature": signature },
  body,
});
console.log(res.status, await res.text(), userId);
