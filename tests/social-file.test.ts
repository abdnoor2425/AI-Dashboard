import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";
import { dayOf, networksFor, numberOf, socialFromJson, socialFromTables, tableFromText, tableOf } from "../lib/social-file.ts";
import { newestFile, readSocial, refreshSocial, saveUpload, sheetsOf, socialFolder } from "../lib/server/social-file.ts";
import { handle } from "../lib/api.ts";
import { makeState, makeWorkspace } from "../lib/sample.ts";

const DAY = 86400000, day = (n: number) => new Date(Date.UTC(2026, 10, 9) + n * DAY).toISOString().slice(0, 10);
// 14 days for two networks: Instagram reach 100 a day then 200 a day, followers climbing by 10 a day.
const longCsv = () => ["Date,Network,Followers,Reach", ...Array.from({ length: 14 }, (_, i) => [`${day(i)},Instagram,${1000 + i * 10},${i < 7 ? 100 : 200}`, `${day(i)},TikTok,${500 + i},${50}`]).flat()].join("\n");

test("numbers and dates are read the way people write them", () => {
  assert.deepEqual(["12,345", "12.345", "1.2K", "3,4 M", "1,234.5", "1.234,5", "0.5", "45%", "n/a", "1,5"].map(numberOf), [12345, 12345, 1200, 3400000, 1234.5, 1234.5, 0.5, null, null, 1.5]);
  assert.equal(dayOf("2026-11-23"), Date.UTC(2026, 10, 23));
  assert.equal(dayOf("23/11/2026"), Date.UTC(2026, 10, 23));
  assert.equal(dayOf("11/23/2026"), Date.UTC(2026, 10, 23));
  assert.equal(dayOf("03/04/2026"), Date.UTC(2026, 2, 4));
  assert.equal(dayOf("03/04/2026", true), Date.UTC(2026, 3, 3));
  assert.equal(dayOf("Nov 23, 2026"), Date.UTC(2026, 10, 23));
  assert.equal(dayOf(46349), Date.UTC(2026, 10, 23));
  assert.equal(dayOf("hello"), null);
});

test("a daily CSV becomes this week, last week and followers for each network", () => {
  const f = socialFromTables([tableOf(longCsv())], "metricool.csv", 1);
  const [ig, tt] = f.brands[""];
  assert.deepEqual([ig.id, ig.reach, ig.reachPrev, ig.followers, ig.followersDelta, ig.series.length], ["instagram", 1400, 700, 1130, 70, 7]);
  assert.deepEqual([tt.id, tt.reach, tt.reachPrev, tt.followers], ["tiktok", 350, 350, 513]);
  assert.equal(f.rows, 28);
  assert.equal(f.to, Date.UTC(2026, 10, 22));
});

test("other shapes of file: a summary, semicolons, one column per network, a title row, and the network in the file name", () => {
  const summary = socialFromTables([tableOf('Informe de Metricool\n\nRed social;Seguidores;Alcance;Nuevos seguidores\nInstagram;"12.840";48.210;96\nFacebook;3.100;9.050;-4\n')], "x.csv", 1).brands[""];
  assert.deepEqual(summary.map((n) => [n.id, n.followers, n.reach, n.followersDelta]), [["instagram", 12840, 48210, 96], ["facebook", 3100, 9050, -4]]);
  const wide = socialFromTables([tableOf(`Date\tInstagram followers\tInstagram reach\tLinkedIn followers\tLinkedIn impressions\n${day(12)}\t100\t10\t50\t5\n${day(13)}\t104\t20\t51\t7\n`)], "x.tsv", 1).brands[""];
  assert.deepEqual(wide.map((n) => [n.id, n.followers, n.followersDelta, n.reach]), [["instagram", 104, 4, 30], ["linkedin", 51, 1, 12]]);
  const named = socialFromTables([tableOf(`Day,Followers,Reach\n${day(13)},77,9\n`)], "tiktok_export.csv", 1).brands[""];
  assert.deepEqual([named[0].id, named[0].followers], ["tiktok", 77]);
  assert.throws(() => socialFromTables([tableOf("Name,Email\nDana,dana@example.com\n")], "people.csv", 1), /No followers or reach/);
});

test("brands in a file go to the matching website, and everything adds up for all websites", () => {
  const f = socialFromTables([tableOf("Brand,Network,Followers,Reach\nPlatewise,Instagram,100,10\nPlatewise,TikTok,40,4\nFernway,Instagram,50,5\n")], "b.csv", 1);
  assert.deepEqual(networksFor(f, { name: "Platewise", domain: "platewise.com" })!.map((n) => n.followers), [100, 40]);
  assert.deepEqual(networksFor(f, { name: "Fernway" })!.map((n) => n.followers), [50]);
  assert.equal(networksFor(f, { name: "Unknown shop" }), null);
  assert.deepEqual(networksFor(f)!.map((n) => [n.id, n.followers, n.reach]), [["instagram", 150, 15], ["tiktok", 40, 4]]);
});

test("JSON from an AI, in the ready shape or as plain rows, and words from a PDF report", () => {
  const ready = socialFromJson({ networks: [{ network: "instagram", followers: "12,840", followersDelta: 96, reach: 48210, reachPrev: 45100, series: [{ date: "2026-11-22", reach: 7020 }] }] }, "m.json", 1);
  assert.deepEqual([ready.brands[""][0].followers, ready.brands[""][0].reach, ready.brands[""][0].series[0].t], [12840, 48210, Date.UTC(2026, 10, 22)]);
  const rows = socialFromJson([{ date: day(13), platform: "YouTube", subscribers: 900, views: 1200 }], "m.json", 1);
  assert.deepEqual([rows.brands[""][0].id, rows.brands[""][0].followers, rows.brands[""][0].reach], ["youtube", 900, 1200]);
  assert.throws(() => socialFromJson({ hello: 1 }, "m.json", 1), /No followers or reach/);
  const pdf = socialFromTables([tableFromText("Monthly report\nInstagram\nFollowers 12,840\nReach: 48.2K\nFacebook\n3,100 followers\nImpressions 9,050\n")], "report.pdf", 1).brands[""];
  assert.deepEqual(pdf.map((n) => [n.id, n.followers, n.reach]), [["instagram", 12840, 48200], ["facebook", 3100, 9050]]);
});

// A tiny .xlsx made here: a zip with a shared-strings file and one sheet.
function xlsx(files: Record<string, string>, deflate: boolean) {
  const parts: Buffer[] = [], central: Buffer[] = []; let at = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text), data = deflate ? zlib.deflateRawSync(raw) : raw, n = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(at, 42);
    parts.push(local, n, data); central.push(c, n); at += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...parts, cd, end]);
}
const BOOK = {
  "xl/sharedStrings.xml": '<sst><si><t>Date</t></si><si><t>Network</t></si><si><t>Followers</t></si><si><r><t>Re</t></r><r><t>ach</t></r></si><si><t>Instagram</t></si></sst>',
  "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row><row r="2"><c r="A2"><v>46348</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>900</v></c><c r="D2"><v>40</v></c></row><row r="3"><c r="A3"><v>46349</v></c><c r="B3" t="s"><v>4</v></c><c r="D3"><v>60</v></c><c r="C3"><v>925</v></c></row></sheetData></worksheet>',
};

test("an Excel file is read without any extra software, packed or not", async () => {
  for (const packed of [true, false]) {
    const buf = xlsx(BOOK, packed);
    assert.deepEqual(sheetsOf(buf)[0][0], ["Date", "Network", "Followers", "Reach"]);
    const f = await readSocial("Metricool export.xlsx", buf, 5);
    assert.deepEqual([f.brands[""][0].id, f.brands[""][0].followers, f.brands[""][0].followersDelta, f.brands[""][0].reach, f.to], ["instagram", 925, 25, 100, Date.UTC(2026, 10, 23)]);
  }
  await assert.rejects(readSocial("broken.xlsx", Buffer.from("not a workbook"), 1), /could not be opened/);
  await assert.rejects(readSocial("notes.docx", Buffer.from("x"), 1), /CSV, Excel/);
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Network,Followers\nInstagram,42\n", "utf16le")]);
  assert.equal((await readSocial("win.csv", utf16, 1)).brands[""][0].followers, 42);
});

test("the Metricool folder: the newest file is shown, a bad one says why, and the Social page and Overview use it", async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "aid-social-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const state: any = makeState(); state.onboarded = true;
  const ws: any = (state.workspaces.mine = makeWorkspace({ id: "mine", name: "Reyes Studio", owner: "Dana", kind: "owner", empty: true }, Date.now())); state.active = "mine";
  assert.equal(await refreshSocial(ws, home), false);
  assert.equal(handle(state, { method: "GET", path: "/api/social" }).data.state, "unmatched");

  const saved = saveUpload("mine", "../../evil name?.csv", Buffer.from(longCsv()), home);
  assert.equal(path.dirname(saved), socialFolder("mine", home));
  assert.ok(fs.existsSync(path.join(socialFolder("mine", home), "READ ME.txt")));
  assert.equal(newestFile("mine", home)!.path, saved);
  assert.throws(() => saveUpload("mine", "run.exe", Buffer.from("x"), home), /CSV, Excel/);

  assert.equal(await refreshSocial(ws, home), true);
  assert.equal(await refreshSocial(ws, home), false);
  const cn = ws.connections.find((c: any) => c.id === "metricool");
  assert.deepEqual([cn.status, cn.account], ["connected", "From a file"]);
  const social = handle(state, { method: "GET", path: "/api/social" }).data;
  assert.deepEqual([social.state, social.totals.reach, social.totals.followers, social.source, social.file.used, social.pending.length], ["ok", 1750, 1643, "Metricool file", true, 0]);
  assert.equal(social.reach.length, 7);
  const reach = handle(state, { method: "GET", path: "/api/overview" }).data.numbers.find((n: any) => n.id === "reach");
  assert.deepEqual([reach.value, reach.source], [1750, "Metricool file"]);

  // The AI saves a newer file that cannot be read: the good numbers stay, and the reason is kept.
  const bad = path.join(socialFolder("mine", home), "newer.csv");
  fs.writeFileSync(bad, "Name,Email\nDana,dana@example.com\n"); fs.utimesSync(bad, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
  assert.equal(await refreshSocial(ws, home), true);
  assert.match(ws.socialFileProblem.error, /No followers or reach/);
  assert.equal(handle(state, { method: "GET", path: "/api/social" }).data.totals.reach, 1750);
  assert.equal(await refreshSocial(ws, home), false);
  // Sample workspaces never read the folder.
  assert.equal(await refreshSocial(state.workspaces.main, home), false);
});
