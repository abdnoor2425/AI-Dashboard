#!/usr/bin/env node
// One entry for both MCP servers, so every AI app is set up the same way.
//   node mcp/server.mjs                       the owner's dashboard (reads http://localhost:3210)
//   node mcp/server.mjs /private/install/dir  one client installation (reads its local database, read only)
await import(process.argv[2] ? "./workos.mjs" : "./dashboard.mjs");
