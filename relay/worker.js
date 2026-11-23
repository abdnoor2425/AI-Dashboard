// Google sign-in relay for AI-Dashboard. Runs as a Cloudflare Worker (see README.md in this folder).
// Its only job: add the Google app's secret when a dashboard swaps a sign-in code, or a refresh token, for an access token.
// It stores nothing and logs nothing. The answer from Google goes straight back to the dashboard that asked.
// Settings (kept in the host, never in the repo): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const FIELDS = { authorization_code: ["code", "code_verifier", "redirect_uri"], refresh_token: ["refresh_token"] };
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?\/api\/oauth\/google\/callback$/;
const MAX = 8 * 1024;

const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handle(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/") return answer(200, { ok: true, service: "ai-dashboard-google-relay" });
  if (url.pathname !== "/token") return answer(404, { error: "not_found" });
  if (request.method !== "POST") return answer(405, { error: "method_not_allowed" });
  if (!env || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return answer(503, { error: "relay_not_configured" });
  const raw = await request.text();
  if (raw.length > MAX) return answer(413, { error: "too_large" });
  const sent = new URLSearchParams(raw);
  const grant = sent.get("grant_type") || "";
  const wanted = FIELDS[grant];
  if (!wanted) return answer(400, { error: "unsupported_grant_type" });
  // Only this dashboard's own Google app is served, so the relay cannot be borrowed for another app.
  if (sent.get("client_id") && sent.get("client_id") !== env.GOOGLE_CLIENT_ID) return answer(400, { error: "wrong_client" });
  const out = new URLSearchParams({ grant_type: grant, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET });
  for (const k of wanted) { const v = sent.get(k); if (!v) return answer(400, { error: "missing_" + k }); out.set(k, v); }
  // A sign-in may only come back to a dashboard on the person's own computer.
  if (grant === "authorization_code" && !LOCAL.test(out.get("redirect_uri"))) return answer(400, { error: "redirect_not_local" });
  let r;
  try { r = await fetcher(GOOGLE_TOKEN, { method: "POST", redirect: "error", headers: { "content-type": "application/x-www-form-urlencoded" }, body: out }); }
  catch { return answer(502, { error: "google_unreachable" }); }
  return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export default { fetch: (request, env) => handle(request, env) };
