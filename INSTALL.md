# Install AI-Dashboard

This page is written for the AI that installs AI-Dashboard for someone: Claude Code, Codex or any other coding assistant. A person can follow it too.

The person only has to say something like **"Install AI-Dashboard from https://github.com/abdnoor2425/AI-Dashboard"**. Do the steps below, then tell them it's ready.

## 1. Check what's needed

- **git** (`git --version`)
- **Node.js 20 or newer** (`node --version`). If it is missing or older, ask the person before installing it. On Windows: `winget install OpenJS.NodeJS.LTS`. On a Mac: `brew install node`, or the installer from https://nodejs.org.

## 2. Download and build it

Put it somewhere the person keeps their own things, for example their home folder or Documents.

```bash
git clone https://github.com/abdnoor2425/AI-Dashboard.git
cd AI-Dashboard
npm install
npm run build
```

## 3. Make it an app on this computer

```bash
npm run setup
```

This does three things:

- **Windows:** puts an AI-Dashboard icon on the desktop and in the Start menu.
- **Mac:** puts AI-Dashboard in Applications and in the Dock.
- **Linux:** adds it to the app menu and the desktop.
- Starts it quietly in the background whenever the person logs in.
- Opens it once, in its own window (Chrome or Edge app mode, with no tabs or address bar).

The first time it opens, the person sees the welcome flow. They sign in with Google, connect their tools, connect their AI (Claude Code, Codex, the Claude desktop app, Gemini CLI or Cursor, one click each), and set up their profile. There is nothing for you to configure, no keys to paste and no sample data.

## 4. Tell the person

Tell them, in plain words: "AI-Dashboard is installed. Click the AI-Dashboard icon on your desktop (or in the Dock on a Mac) whenever you want it. It's open now, so you can start with the welcome steps."

When Google shows "Google hasn't verified this app", they click **Advanced**, then **Go to AI-Dashboard**. That screen is expected.

## Updating it later

In the AI-Dashboard folder:

```bash
git pull
npm install
npm run build
npm run setup -- --restart
```

## Other commands

| Command | What it does |
| --- | --- |
| `npm run open` | Starts it if it isn't running, and opens the window |
| `npm run setup -- --no-open` | Adds the icon without opening the app |
| `npm run setup -- --remove` | Removes the icon and the start-at-login entry, and stops it |

Everything the dashboard stores stays in the `.keystone` folder inside the AI-Dashboard folder. Deleting that folder starts it fresh, with the welcome flow again.

## Let the person ask their AI about the dashboard

The welcome flow's "Your AI" step, and the Connections page, connect AI apps with one click. To do it by hand instead:

```bash
claude mcp add ai-dashboard -- node /full/path/to/AI-Dashboard/mcp/server.mjs
# or
codex mcp add ai-dashboard -- node /full/path/to/AI-Dashboard/mcp/server.mjs
```
