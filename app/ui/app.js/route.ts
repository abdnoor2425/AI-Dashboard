// Serves the dashboard's screen code as one script. The parts live in ui/js and run in file-name order, sharing one scope.
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "ui", "js");
let built = "", stamp = "";

export async function GET() {
  // Built again only when a part changes, so an update shows up without a restart.
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).sort();
  const now = files.map((f) => f + fs.statSync(path.join(DIR, f)).mtimeMs).join("|");
  if (now !== stamp) {
    built = "(async function(){\n" + files.map((f) => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(DIR, f), "utf8")).join("\n") + "\n})().catch(function(e){console.error(e)});\n";
    stamp = now;
  }
  return new Response(built, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
}
