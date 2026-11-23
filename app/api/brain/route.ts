import { NextRequest, NextResponse } from "next/server";
import { BrainError, brainFilePath, brainSummary, browseFolders, findFolders, changeBrain, getBrain, getBrainNode } from "@/lib/server/brain";
import { openPath } from "@/lib/server/made";
import { hasWorkspace, loadState } from "@/lib/server/store";

import { requireWorkOSLauncher } from "@/lib/workos/launcher-only";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function readRequest(req: NextRequest) {
  if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) {
    throw new BrainError("Folder changes require a JSON request.", 415);
  }
  const reader = req.body?.getReader();
  if (!reader) throw new BrainError("Enter a folder action.");
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 12000) {
        await reader.cancel();
        throw new BrainError("The folder request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks, total).toString("utf8")); } catch { throw new BrainError("The folder request contains invalid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BrainError("Enter a folder action.");
  return body as Record<string, unknown>;
}

async function serve(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const origin = req.headers.get("origin");
  if (!local.test(host) || (origin && origin !== "http://" + host) || req.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "Second Brain only answers same-origin requests on localhost." }, 403);
  }
  const post = req.method === "POST";
  try {
    const body = post ? await readRequest(req) : {};
    const query = req.nextUrl.searchParams;
    // Asked without a workspace (this is what the owner's own AI does): an outline of the open workspace. Names and counts, never contents.
    if (!post && !query.get("workspaceId")) return json(brainSummary(loadState().active) || { connected: false, note: "No WorkOS or project folder is connected to the Second Brain yet." });
    const workspaceId = post ? body.workspaceId : query.get("workspaceId");
    if (typeof workspaceId !== "string" || !workspaceId || !hasWorkspace(workspaceId)) {
      throw new BrainError("Select an existing workspace.", 404);
    }
    // Open one indexed file with the computer's own app, or show it in its folder.
    if (post && body.action === "open") return json(await openPath(brainFilePath(workspaceId, String(body.id || "")), String(body.how || "folder")));
    if (post) return json(changeBrain(workspaceId, body));
    if (query.get("action") === "node") return json(getBrainNode(workspaceId, query.get("id") || ""));
    if (query.get("action") === "browse") return json(browseFolders(query.get("path")));
    if (query.get("action") === "find") return json(findFolders(query.get("q"), query.get("has") || ""));
    return json(getBrain(workspaceId));
  } catch (err) {
    if (err instanceof BrainError) return json({ error: err.message }, err.status);
    return json({ error: "AI-Dashboard could not complete the Second Brain request." }, 500);
  }
}

// In client mode (a WorkOS installation) the dashboard API is closed: everything goes through the installation's own launcher.
const guarded: typeof serve = (...args) => (process.env.WORKOS_LOCAL_CLIENT === "1" ? (requireWorkOSLauncher() as any) : serve(...args));
export const GET = guarded;
export const POST = guarded;
