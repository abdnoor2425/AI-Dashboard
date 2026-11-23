# Google sign-in relay

AI-Dashboard lets each person connect Google with one click. Google needs the app's secret when a sign-in is
finished. That secret must not sit in a public repo, so this tiny relay holds it instead.

What it does: a dashboard sends the one-time sign-in code (or its refresh token) to the relay, the relay adds the
secret and asks Google, and Google's answer goes straight back. The relay keeps nothing and logs nothing. It never
sees anyone's emails, files, calendar or numbers: those are read by each person's own dashboard, on their own computer.

## Put it online (once, by the owner of the Google app)

1. In Google Cloud, open the "AI-Dashboard" app's credentials, add a new client secret, and delete the old one.
2. Create a free Cloudflare account, open Workers, and create a Worker. Paste in `worker.js`.
3. In the Worker's Settings, add two secrets: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Copy the Worker's address (it looks like `https://name.account.workers.dev`).
5. The address is set as the default for `relayUrl` in `lib/server/google-app.ts` (or set `GOOGLE_RELAY_URL` to use another relay).

Opening the address in a browser should show `{"ok":true,...}`.

## Rules the relay enforces

- Only `POST /token`, only the two grant types Google sign-in needs.
- Only this dashboard's own Google app.
- A sign-in may only return to `localhost` or `127.0.0.1`, which is a dashboard on the person's own computer.
