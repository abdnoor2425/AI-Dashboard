# Keystone

A calm business dashboard that runs on your own laptop.

You connect your own tools, it shows you what needs you today, and you can ask the Claude Code or Codex plan you already pay for about any of it. There is no cloud account, no shared server and no paid API key.

"Keystone" is a working name. Change it in Settings.

## Start it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run build
npm start
```

Then open http://localhost:3210.

It opens on a **sample workspace** full of made-up examples, so you can look around first. Every sample screen says "Sample data". When you are ready, go to **Settings, Workspaces, Start with my own data**. That workspace starts empty and only ever shows what your connected tools report.

## What is in it

Every page has its own address and its own endpoint, and the important parts also appear on Overview.

| Page | Address | Endpoint |
| --- | --- | --- |
| Overview | `/` | `/api/overview` |
| Needs your attention | `/attention` | `/api/attention` |
| Website | `/website` | `/api/websites`, `/api/website` |
| Social | `/social` | `/api/social` |
| Reel scores | `/reels` | `/api/reels` |
| Goals | `/goals` | `/api/goals` |
| Metrics | `/metrics` | `/api/metrics` |
| Decision Room | `/decisions` | `/api/decisions` |
| Clients | `/clients` | `/api/clients` |
| Inbox, Calendar, Files | `/inbox`, `/calendar`, `/files` | same names |
| Outputs, Skills, Suggestions, AI usage | `/outputs`, `/skills`, `/suggestions`, `/usage` | same names |
| Connections, Setup, Settings | `/connections`, `/setup`, `/settings` | same names |

`GET /api` lists every endpoint.

## How "Needs your attention" is ranked

Each item gets 0 to 5 on five questions. The score is out of 100:

`7 x Urgency + 6 x Business impact + 4 x You unblock + 2 x Goal alignment + 1 x Waiting age`

- A card shows only the action, the next step and the deadline. The score, reasons and sources are one tap away.
- Something unknown is never counted as zero. The item is marked "needs context" and waits under **Needs checking** unless a real deadline is within a day.
- Two records about the same thing become one card and get no extra priority.
- Ties are broken the same way every time: score, earliest deadline, oldest overdue follow-up, then id.
- You can pin, move or snooze anything. Each change is saved with who and why, and can be undone.
- The weights are a versioned setting (Settings, Ranking). Changing them makes a new version.
- Ranking only suggests an order. Nothing is ever sent, approved or changed for you.

The rules live in `lib/scoring.ts` and are covered by `npm test`.

## Connect your tools

Open **Connections**. The dashboard only reads from your tools, apart from the comments and alerts you choose to send (see below), and sign-ins are saved in `.keystone/secrets.json` on your laptop, apart from your data.

**Google (Analytics, Gmail, Drive)** uses one sign-in with your own Google OAuth client, so no shared key ships with this app:

1. In [Google Cloud Console](https://console.cloud.google.com), make a project and enable the Google Analytics Admin, Google Analytics Data, Gmail and Drive APIs. Google Calendar is optional: connect it from Connections if you want it, and enable the Calendar API first.
2. Under "Credentials", create an OAuth client ID of type "Web application".
3. Add the return address shown on the Connections page (`http://localhost:3210/api/oauth/google/callback`).
4. Paste the client ID and secret into Connections and sign in.

Your websites are then found in Google Analytics by themselves. You never type them in.

**Metricool** needs its Advanced or Custom plan. Paste your user ID and API token. Each website is matched to a Metricool brand by name, and social numbers stay hidden for a website until you confirm its match.

**Linear** takes a personal API key. Open tasks assigned to you become attention items.

### What has and has not been tested

Being straight about this matters more than looking finished:

- Tested here: the whole app on sample data, the ranking rules, saving to disk, workspaces, the Claude Code link and the MCP server.
- **Not yet tested against live accounts:** the Google, Metricool and Linear connectors. They are written from each service's public documentation. The Metricool analytics calls are the least certain. If a call fails, the tool shows "Needs attention" with the reason, and nothing is made up to fill the gap.
- Not built yet: Slack, and importing a reel scorecard sheet. Both show as "Coming later". In a real workspace the Reel scores page stays empty until then.
- The reel scorecard checks in the sample data are placeholders. Swap in your own scorecard's names.
- The Second Brain is planned for later.

## Your team, comments and alerts

**Your team** shows who leads and who does what. The first person is always The Leader; everyone else can have any name, role, place in the tree and character. Add an email to a person if you want alerts to be able to reach them by email.

Open any item on **Attention** to act on it:

- **Comment on Linear.** When an item comes from Linear you see who the ticket is assigned to, and a box that posts your comment straight onto the ticket with your saved Linear key. If you created the key as read only, make a new one that can write.
- **Alert your team.** Pick one or more people. On a Linear ticket each person is subscribed and mentioned in a comment, so Linear notifies them. Anyone not found in Linear, and every alert on an item from another tool, goes by email from your Gmail. The first time, the dashboard asks you to allow Gmail to send; until you do, it cannot send anything.

Nothing is sent unless you press the button yourself.

## Ask your own AI plan

**In the app:** press Cmd K (or Ctrl K), type a question and choose "Ask your AI". If the `claude` or `codex` command is installed on this laptop, the dashboard hands it your question with the numbers on screen and shows the answer. If neither is installed, simple built-in rules answer instead, and say so.

**In your terminal:** give Claude Code or Codex access to the dashboard. Run one line once (the Connections page shows it with your real path):

```bash
claude mcp add keystone -- node /full/path/to/keystone/mcp/server.mjs
codex  mcp add keystone -- node /full/path/to/keystone/mcp/server.mjs
```

Then ask things like "What needs my attention today?" or "Which reels are on hold and why?". The dashboard has to be running. The AI can read every page. It can also do two things when you ask it to: post a comment on a Linear ticket ("Comment on PLT-212 that the cut is approved") and alert people on your team about an item.

## Workspaces

A workspace is one business with its own data, connections, colours and ranking rules. New ones are made from the same template (Settings, Workspaces) and never see each other. The app ships with three sample workspaces so you can see that.

## Privacy

- Your data lives in `.keystone/` inside this folder. Delete that folder to start again.
- The app only answers on `localhost` and refuses requests from other websites.
- It talks to the tools you connect, and to nothing else. Next.js telemetry is switched off.
- Export never includes sign-ins or tokens.
- `.keystone/` is in `.gitignore`. Never commit it.

## For developers

```bash
npm run dev      # the app with live reload
npm test         # ranking, isolation and endpoint tests
npm run preview  # one self-contained HTML file with sample data, in preview/keystone.html
```

- `lib/api.ts` is one router used by the server, the MCP server and the preview, so they can never drift apart.
- `lib/scoring.ts` is the ranking. `lib/sample.ts` is the template and the sample data.
- `lib/server/` holds the parts that only run on the laptop: storage, sign-ins, sync and the AI link.
- `views/` has one file per page. `components/` has the shell, charts and shared pieces.
- `lib/motion.ts` is the app's own motion code: spring curves, the card-to-panel transition and the daylight background.

Stack: Next.js, React, Tailwind CSS. No database: one JSON file.

## License

MIT
