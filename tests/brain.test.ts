import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brainSummary, browseFolders, findFolders, changeBrain, dropBrain, getBrain, getBrainNode } from "../lib/server/brain.ts";

test("indexes approved folders per workspace and follows explicit references", t => {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), "keystone-brain-test-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "local-data");
  const root = path.join(temp, "Project alpha");
  const second = path.join(temp, "Project beta");
  fs.mkdirSync(path.join(root, "notes"), { recursive: true });
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(second, "private.md"), "Second workspace.");
  fs.writeFileSync(path.join(root, "notes", "Plan.MD"), "A first plan.");
  fs.writeFileSync(path.join(root, "Readme.md"), "[plan](notes/Plan.MD)\n[[Plan]]\n[elsewhere](../Project%20beta/private.md)\n[web](https://example.test)");
  fs.writeFileSync(path.join(root, ".env.local"), "PRIVATE=1");
  fs.writeFileSync(path.join(root, "app-credentials.json"), "private");
  fs.writeFileSync(path.join(root, "photo.jpg"), Buffer.from([255, 0, 1]));
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.writeFileSync(path.join(root, "node_modules", "ignored.md"), "private");

  const first = changeBrain("workspace-a", { action: "connect", path: root, name: "Alpha" }, home);
  const beta = changeBrain("workspace-b", { action: "connect", path: second }, home);
  assert.equal(first.projects[0].name, "Alpha");
  assert.equal(first.sources[0].fileCount, 3);
  assert.equal(first.sources[0].skipped, 3);
  assert.deepEqual(first.nodes.map(n => n.path).sort(), ["", "Readme.md", "notes", "notes/Plan.MD", "photo.jpg"]);
  const readme = first.nodes.find(node => node.name === "Readme.md")!;
  const plan = first.nodes.find(node => node.name === "Plan.MD")!;
  const photo = first.nodes.find(node => node.name === "photo.jpg")!;
  assert.deepEqual(first.links.filter(link => link.kind === "reference"), [{ source: readme.id, target: plan.id, kind: "reference" }]);
  assert.equal(first.links.filter(link => link.kind === "contains").length, 4);
  assert.equal(getBrainNode("workspace-a", plan.id, home).content, "A first plan.");
  assert.equal(getBrainNode("workspace-a", photo.id, home).content, null);
  assert.throws(() => getBrainNode("workspace-b", readme.id, home), /not in the selected workspace/);
  assert.throws(() => changeBrain("workspace-b", { action: "disconnect", sourceId: first.sources[0].id }, home), /not connected/);
  assert.throws(() => changeBrain("workspace-a", { action: "connect", path: path.join(root, "notes") }, home), /already part of/);
  assert.deepEqual(getBrain("workspace-a", home), first);
  assert.equal(fs.readdirSync(home).length, 2);
  for (const file of fs.readdirSync(home)) assert.doesNotMatch(fs.readFileSync(path.join(home, file), "utf8"), /A first plan\.|Second workspace\./);

  fs.writeFileSync(path.join(root, "notes", "Plan.MD"), "New plan.");
  fs.rmSync(path.join(root, "photo.jpg"));
  fs.writeFileSync(path.join(root, "new.txt"), "Fresh.");
  const rescanned = changeBrain("workspace-a", { action: "rescan", sourceId: first.sources[0].id }, home);
  assert.equal(rescanned.sources[0].id, first.sources[0].id);
  assert.ok(rescanned.nodes.some(node => node.name === "new.txt"));
  assert.throws(() => getBrainNode("workspace-a", photo.id, home), /not in the selected workspace/);
  assert.equal(getBrainNode("workspace-a", plan.id, home).content, "New plan.");
  assert.deepEqual(changeBrain("workspace-a", { action: "disconnect", sourceId: first.sources[0].id }, home).nodes, []);
  assert.deepEqual(getBrain("workspace-b", home), beta);
  assert.ok(fs.existsSync(path.join(root, "Readme.md")));
  dropBrain("workspace-b", home);
  assert.deepEqual(getBrain("workspace-b", home).sources, []);
});

test("refuses broad roots, traversal, symlinks, and hard links", t => {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), "keystone-brain-test-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "local-data");
  const root = path.join(temp, "project");
  const other = path.join(temp, "other");
  fs.mkdirSync(root);
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "outside.md"), "Outside.");
  fs.linkSync(path.join(other, "outside.md"), path.join(root, "hard.md"));
  fs.symlinkSync(other, path.join(root, "junction"), process.platform === "win32" ? "junction" : "dir");
  fs.writeFileSync(path.join(root, "real.md"), "Original.");
  for (const folder of [os.homedir(), path.parse(root).root, "project", root + path.sep + ".." + path.sep + "other", path.join(root, "junction")]) {
    assert.throws(() => changeBrain("main", { action: "connect", path: folder }, home));
  }
  const index = changeBrain("main", { action: "connect", path: root }, home);
  assert.deepEqual(index.nodes.map(node => node.path), ["", "real.md"]);
  const real = index.nodes[1];
  fs.rmSync(path.join(root, "real.md"));
  fs.linkSync(path.join(other, "outside.md"), path.join(root, "real.md"));
  assert.throws(() => getBrainNode("main", real.id, home), /no longer available/);
  fs.renameSync(root, path.join(temp, "previous-project"));
  fs.symlinkSync(other, root, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => changeBrain("main", { action: "rescan", sourceId: index.sources[0].id }, home), /could not be found or opened/);
  assert.deepEqual(getBrain("main", home), index);
});

test("a WorkOS turns each folder into a project, ties projects together, and can leave folders out", t => {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), "keystone-brain-test-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "local-data");
  const root = path.join(temp, "WorkOS");
  for (const dir of ["01 Launch/notes", "Brand voice", "Archive"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, "01 Launch", "plan.md"), "See [voice](../Brand%20voice/guide.md).");
  fs.writeFileSync(path.join(root, "01 Launch", "notes", "call.txt"), "We agreed to follow the Brand Voice rules.");
  fs.writeFileSync(path.join(root, "Brand voice", "guide.md"), "Used by the launch.");
  fs.writeFileSync(path.join(root, "Archive", "old.md"), "Old.");

  const brain = changeBrain("main", { action: "connect", path: root, kind: "workos" }, home);
  assert.equal(brain.sources[0].kind, "workos");
  assert.deepEqual(brain.projects.map(p => [p.name, p.files, p.folders]).sort(), [["01 Launch", 2, 1], ["Archive", 1, 0], ["Brand voice", 1, 0]]);
  const id = (name: string) => brain.nodes.find(n => n.name === name)!.id;
  assert.equal(brain.nodes.find(n => n.name === "call.txt")!.project, id("01 Launch"));
  assert.deepEqual(brain.links.filter(l => l.kind === "reference"), [{ source: id("plan.md"), target: id("guide.md"), kind: "reference" }]);
  assert.deepEqual(brain.links.filter(l => l.kind === "mention").map(l => [l.source, l.target]).sort(), [[id("call.txt"), id("Brand voice")], [id("guide.md"), id("01 Launch")]].sort(),
    "a note that names another project is tied to it, and a project never mentions itself");
  assert.deepEqual(brainSummary("main", home)!.projects.find(p => p.name === "01 Launch")!.connectedTo, ["Brand voice"]);

  const without = changeBrain("main", { action: "leave-out", sourceId: brain.sources[0].id, path: "Archive" }, home);
  assert.deepEqual(without.sources[0].excluded, ["Archive"]);
  assert.ok(!without.projects.some(p => p.name === "Archive"));
  assert.equal(without.sources[0].skipped, 0, "left out is a choice, not a skipped file");
  assert.ok(changeBrain("main", { action: "rescan", sourceId: brain.sources[0].id }, home).sources[0].excluded!.includes("Archive"), "a rescan keeps what was left out");
  assert.ok(changeBrain("main", { action: "leave-out", sourceId: brain.sources[0].id, path: "Archive", leftOut: false }, home).projects.some(p => p.name === "Archive"));
  assert.throws(() => changeBrain("main", { action: "leave-out", sourceId: brain.sources[0].id, path: "../other" }, home));
  assert.ok(fs.existsSync(path.join(root, "Archive", "old.md")));

  const listing = browseFolders(root);
  assert.deepEqual(listing.folders.map(f => f.name), ["01 Launch", "Archive", "Brand voice"]);
  assert.equal(listing.parent, temp);
});

test("a folder is found by name, and a dropped folder by its name and what is inside it", t => {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), "keystone-find-test-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const p of ["Documents/WorkOS/Clients", "Documents/WorkOS/Playbooks", "Old/WorkOS/Drafts", "Documents/Workshop notes", "node_modules/WorkOS", ".hidden/WorkOS"]) fs.mkdirSync(path.join(temp, p), { recursive: true });
  fs.writeFileSync(path.join(temp, "Documents", "WorkOS", "README.md"), "hello");

  const byName = findFolders("workos", "", temp);
  assert.deepEqual(byName.results.map(r => r.path).sort(), [path.join(temp, "Documents", "WorkOS"), path.join(temp, "Old", "WorkOS")].sort());
  const mine = byName.results.find(r => r.path === path.join(temp, "Documents", "WorkOS"))!;
  assert.deepEqual([mine.folders, mine.files, mine.where], [2, 1, "Documents"]);
  assert.deepEqual(findFolders("work", "", temp).results.map(r => r.name).sort(), ["WorkOS", "WorkOS", "Workshop notes"]);
  assert.deepEqual(findFolders("w", "", temp).results, []);

  const dropped = findFolders("WorkOS", "Clients|Playbooks|README.md", temp);
  assert.equal(dropped.sure, true);
  assert.equal(dropped.results[0].path, path.join(temp, "Documents", "WorkOS"));

  const listing = browseFolders(path.join(temp, "Documents"));
  assert.deepEqual(listing.folders.map(f => [f.name, f.folders, f.files]), [["WorkOS", 2, 1], ["Workshop notes", 0, 0]]);
});
