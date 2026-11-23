# AI-Dashboard

Your whole business on one calm page, on your own computer.

You connect your own tools, it shows you what needs you today, and you can ask the Claude Code or Codex plan you already pay for about any of it. There is no cloud account, no shared server and no paid API key.

## Install it

Ask your AI (Claude Code, Codex or similar):

> Install AI-Dashboard from https://github.com/abdnoor2425/AI-Dashboard

It follows [INSTALL.md](INSTALL.md): it downloads and builds the dashboard, adds an AI-Dashboard icon to your desktop and Start menu (or Applications and the Dock on a Mac), and opens it.

To do it yourself, you need [Node.js](https://nodejs.org) 20 or newer:

```bash
git clone https://github.com/abdnoor2425/AI-Dashboard.git
cd AI-Dashboard
npm install
npm run build
npm run setup
```

The first time it opens, a short welcome flow walks you through signing in with Google, connecting your tools and setting up your profile. Then your own data loads in. The sample workspace is still there if you want to look around: **Settings, Workspaces**.

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
| Decision Room (a council on your own AI, with sources and a PDF report) | `/#room` | `/api/room` |
| Money (Stripe), AI news, AI made | `/#money`, `/#news`, `/#made` | `/api/ui`, `/api/news`, `/api/made` |
| Scan for AI | `/#scan` | `/api/ai/agents` |
| Clients | `/clients` | `/api/clients` |
| Inbox, Calendar, Files | `/inbox`, `/calendar`, `/files` | same names |
| Outputs, Skills, Suggestions, AI usage | `/outputs`, `/skills`, `/suggestions`, `/usage` | same names |
| Your team (with Watch it live) | `/team` | `/api/team` |
| Second Brain | `/second-brain`, `/second-brain/edit` | `/api/brain` |
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

**Google Analytics, Gmail, Drive and Calendar:** click **Connect with Google** on the app you want and sign in. That's it. Each app connects on its own, so you only give access to what you use.

While the dashboard's Google app is waiting for Google's review, Google shows a "Google hasn't verified this app" screen once. Click **Advanced**, then **Go to AI-Dashboard**.

<details><summary>For maintainers: the built-in Google app</summary>

The dashboard signs in with one Google app, set in `lib/server/google-app.ts`. The app's secret is not in this repo. It is held by a small relay (see `relay/README.md`) that adds it when a sign-in is finished and keeps nothing; tokens stay on each person's computer. Anyone who prefers their own Google app can set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`. It needs the Google Analytics Admin, Google Analytics Data, Gmail, Drive and Calendar APIs switched on.

</details>

## Client mode: a private workspace for each client

The same download can also run as a small, separate workspace for one client business. It is not a login into your dashboard. Each client gets their own folder, their own password and their own name and colour, and nothing is shared between clients or with you.

A client workspace has a Daily queue and Team queue, a Goal planner that runs from the quarter down to a single day, a catalogue of approved skills, Skill usage, and named sign-ins (operator, reviewer, viewer). It is deliberately quiet: no connected apps, no syncing and no AI calls.

It works on Windows, Mac and Linux and needs Node 24. Ask your AI to "set up a client workspace from the AI-Dashboard folder", or see [docs/WORKOS.md](docs/WORKOS.md). The short version:

```
npm run doctor
npm run workos -- install /path/to/new/client-folder examples/workos/alder.json
npm run workos -- start /path/to/new/client-folder
```

`npm start` and `npm run setup` still open your own dashboard exactly as before.


Your websites are then found in Google Analytics by themselves. You never type them in.

**Metricool** needs its Advanced or Custom plan. Paste your user ID and API token. Each website is matched to a Metricool brand by name, and social numbers stay hidden for a website until you confirm its match.

**Linear** takes a personal API key. Open tasks assigned to you become attention items.

### What has and has not been tested

Being straight about this matters more than looking finished:

- Tested here: the whole app on sample data, the ranking rules, saving to disk, workspaces, the Claude Code link and the MCP server.
- **Not yet tested against live accounts:** the Google, Metricool and Linear connectors. They are written from each service's public documentation. The Metricool analytics calls are the least certain. If a call fails, the tool shows "Needs attention" with the reason, and nothing is made up to fill the gap.
- The Decision Room ran whole councils on Claude Code. Codex, Gemini CLI and Grok use the same steps but have not been run on a real install. The PDF needs Chrome or Edge on the computer.
- Stripe takes one read-only key (it starts with `rk_`) and has not been tried on a live account. AI news reads public feeds, not X.
- The first run (welcome, sign-in, tools, Scan for AI, profile) was walked through on a new install. A real Google sign-in was not completed.
- Not built yet: Slack, and importing a reel scorecard sheet. Both show as "Coming later". In a real workspace the Reel scores page stays empty until then.
- The reel scorecard checks in the sample data are placeholders. Swap in your own scorecard's names.

## Your team, comments and alerts

**Your team** shows who leads and who does what. The first person is always The Leader; everyone else can have any name, role, place in the tree and character. Add an email to a person if you want alerts to be able to reach them by email.

Open any item on **Attention** to act on it:

- **Comment on Linear.** When an item comes from Linear you see who the ticket is assigned to, and a box that posts your comment straight onto the ticket with your saved Linear key. If you created the key as read only, make a new one that can write.
- **Alert your team.** Pick one or more people. On a Linear ticket each person is subscribed and mentioned in a comment, so Linear notifies them. Anyone not found in Linear, and every alert on an item from another tool, goes by email from your Gmail. The first time, the dashboard asks you to allow Gmail to send; until you do, it cannot send anything.

Nothing is sent unless you press the button yourself.

### Watch it live

When a task goes from one person on Your team to another, the dashboard can play the handover. The person who gave it rises out of their card, leans toward the receiver, says a line and tosses a folder with the task on it. The receiver catches it, nods and answers. Afterwards their card shows a small tag with the number of tasks they got this week.

- **What counts as a handover:** a Linear ticket you assigned to someone on Your team, or an alert you sent someone from an item. People are matched by email first, then full name, then first name when only one person has it.
- **Where to start it:** the Watch it live button on a Linear item, right after sending an alert, on the "With your team" card on Overview, and in the Handovers list on Your team.
- **What they say:** a different line is picked each time. Change both lists under Settings, Watch it live.
- Anyone who has reduced motion turned on in their system settings sees the end of the scene without the movement.

## Ask your own AI plan

**In the app:** press Cmd K (or Ctrl K), type a question and choose "Ask your AI". If the `claude` or `codex` command is installed on this laptop, the dashboard hands it your question with the numbers on screen and shows the answer. If neither is installed, simple built-in rules answer instead, and say so.

**In your terminal:** give Claude Code or Codex access to the dashboard. Run one line once (the Connections page shows it with your real path):

```bash
claude mcp add ai-dashboard -- node /full/path/to/AI-Dashboard/mcp/server.mjs
codex  mcp add ai-dashboard -- node /full/path/to/AI-Dashboard/mcp/server.mjs
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
```

- `lib/api.ts` is one router used by the server and the MCP server, so they can never drift apart.
- `ui/` is the look: `ui/shell.html` is the frame, `ui/css` the styles and `ui/js` the screens, served as one script by `app/ui/app.js`. Pages that keep their own React view live in `views/` and are styled by `app/legacy.css`.
- `lib/scoring.ts` is the ranking. `lib/sample.ts` is the template and the sample data.
- `lib/server/` holds the parts that only run on the laptop: storage, sign-ins, sync and the AI link.
- `views/` has one file per page. `components/` has the shell, charts and shared pieces.
- `lib/motion.ts` is the app's own motion code: spring curves, the card-to-panel transition and the daylight background.

Stack: Next.js, React, Tailwind CSS. No database: one JSON file.

## License

MIT

The Decision Room follows the council idea and scoring of [roast-room](https://github.com/nateherkai/roast-room) (MIT, AI Automation Society), and uses its portraits. See `public/portraits/NOTICE.md`. The seats are AI simulations, not the people.

## Second Brain

The Second Brain draws your WorkOS as a globe. A WorkOS is a folder of projects: every folder inside it becomes a project, with its files and the connections between them.

- **Connect it.** Open **Second Brain → Edit sources**, choose **A whole WorkOS**, then browse to the top folder (or paste its path) and press **Add**. If some projects live outside your WorkOS, add each one with **One project folder**. Up to 8 sources per workspace.
- **Read it.** Each project is a region of the globe, each folder a knot inside it, each file a point. Drag to turn it, use + and − to zoom, and use the search to find a file. Pick a project from the dropdown (or click it) and it opens in place: its folders and files in rings, with everything it connects to in other projects around the outside. Click any file to see what it links to, what links to it, and what it says.
- **Connections.** A line is drawn when a note links to another file (Markdown links and `[[wiki links]]`), and a dashed line when a note names another project. Folders hold their files with thin lines in the project's colour.
- **Change it.** On the Edit page: **Read again** after files change, **Leave out** a project that does not belong, or **Remove** a source. None of these touch your files.
- **Ask about it.** Ask your AI knows your projects, how they connect and what changed lately. It is given names and counts only, never file contents. Your own Claude Code or Codex can read the same outline through the `keystone_second_brain` tool.

Everything stays on the computer running Keystone. The index is kept in `.keystone`, separate for each workspace, and nothing is uploaded. The Second Brain only ever reads: it stores file names, sizes, dates and links, and reads text files (up to 128 KB) only when you open one. Hidden files, passwords and keys, dependency and build folders, and shortcuts are always skipped. This is not a secret scanner, so only connect folders you are happy for the dashboard to read. Limits: 6,000 entries per source and 20 folders deep; the Edit page says when a limit was reached. Updates are manual (**Read again**). With nothing connected, and in the static preview, the page shows a clearly marked sample WorkOS.
