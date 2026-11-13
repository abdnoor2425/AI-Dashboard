// Builds preview/keystone.html: one self-contained page that runs the whole app on sample data.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...a) => path.join(root, ...a);

await build({
  entryPoints: [p("preview/entry.tsx")], bundle: true, minify: true, format: "iife", target: "es2020", outfile: p("preview/app.js"),
  jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment", legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "next/link": p("preview/shims/link.tsx"), "next/navigation": p("preview/shims/navigation.tsx"), "react-dom/client": p("preview/shims/react-dom-client.js"), react: p("preview/shims/react.js"), "@": root },
});
execFileSync(p("node_modules/.bin/tailwindcss"), ["-i", p("app/globals.css"), "-o", p("preview/app.css"), "--minify"], { cwd: root, stdio: "pipe" });

const css = readFileSync(p("preview/app.css"), "utf8");
const js = readFileSync(p("preview/app.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const html = `<title>Keystone</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(p("preview/keystone.html"), html);
console.log("preview/keystone.html", (html.length / 1024).toFixed(0) + " KB");
