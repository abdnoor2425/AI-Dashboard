#!/usr/bin/env node
import { isPrivate, samePath } from "../lib/workos/private.mjs";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { configOf, snapshot } from "../lib/workos/operations.ts";
import { kitVersion } from "../lib/workos/config.ts";

const tools = [
  {
    name: "workos_queue",
    description:
      "Read the selected installation's current, next and blocked work.",
  },
  {
    name: "workos_handoff",
    description:
      "Read a versioned assignment, selected skill and receipt for one active task.",
  },
];
const definitions = tools.map((t) => ({
  ...t,
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema:
    t.name === "workos_queue"
      ? { type: "object", properties: {}, additionalProperties: false }
      : {
          type: "object",
          properties: { task: { type: "string" } },
          required: ["task"],
          additionalProperties: false,
        },
}));
function read(name, args) {
  const dir = process.argv[2];
  if (
    !dir ||
    !path.isAbsolute(dir) ||
    !samePath(fs.realpathSync(dir), dir) ||
    !isPrivate(dir)
  )
    throw Error("Select a private installation directory.");
  const file = path.join(dir, "workos.sqlite"),
    st = fs.lstatSync(file);
  if (!st.isFile() || st.nlink !== 1 || !isPrivate(file, st))
    throw Error("Select a private installation database.");
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec("BEGIN");
    const c = configOf(db),
      s = snapshot(db, c, Date.now());
    const brief = (t) => ({
      task: t.id,
      owner: t.owner,
      title: t.title,
      due: t.due,
      prerequisite: t.after,
      ...(t.evidence ? { evidenceRequirement: t.evidence } : {}),
      blocker: t.blocker,
      verified: t.verified,
    });
    const context = {
      installation: c.client,
      planRevision: s.revision,
      goal: s.plan.quarter.title,
    };
    if (name === "workos_queue")
      return { ...context, ...s.queue, tasks: s.tasks.map(brief) };
    const t = s.tasks.find((t) => t.id === args.task);
    if (!t) throw Error("Task unavailable in this installation.");
    return {
      contract: "workos.local-handoff/v1",
      ...context,
      ...brief(t),
      parent: t.parent,
      run: t.run,
      pin: t.selected,
      routing: t.routing,
      receipt: t.receipt,
    };
  } finally {
    db.close();
  }
}
const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
for await (const line of lines) {
  let id = null;
  try {
    if (line.length > 8192) throw Error("Request too large.");
    const m = JSON.parse(line);
    if (!Object.hasOwn(m, "id")) continue;
    id = m.id;
    let result;
    if (m.method === "initialize")
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "workos-local", version: kitVersion },
      };
    else if (m.method === "tools/list") result = { tools: definitions };
    else if (m.method === "ping") result = {};
    else if (m.method === "tools/call") {
      const name = m.params?.name,
        args = m.params?.arguments ?? {};
      if (
        !tools.some((t) => t.name === name) ||
        !args ||
        typeof args !== "object" ||
        Array.isArray(args) ||
        Object.keys(args).some(
          (k) => k !== "task" || name !== "workos_handoff",
        ) ||
        (name === "workos_handoff" && typeof args.task !== "string")
      )
        throw Error("Unknown tool or invalid arguments.");
      try {
        result = {
          content: [{ type: "text", text: JSON.stringify(read(name, args)) }],
        };
      } catch {
        result = {
          isError: true,
          content: [
            {
              type: "text",
              text: "Installation or task unavailable. Check the selected private WorkOS directory.",
            },
          ],
        };
      }
    } else throw Error("Unknown method.");
    console.log(JSON.stringify({ jsonrpc: "2.0", id, result }));
  } catch {
    console.log(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Invalid WorkOS request." },
      }),
    );
  }
}
