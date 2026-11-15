import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { changeBrain, dropBrain, getBrain, getBrainNode } from "../lib/server/brain.ts";

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
  assert.throws(() => changeBrain("workspace-a", { action: "connect", path: path.join(root, "notes") }, home), /overlaps/);
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
  assert.throws(() => changeBrain("main", { action: "rescan", sourceId: index.sources[0].id }, home), /through a link/);
  assert.deepEqual(getBrain("main", home), index);
});
