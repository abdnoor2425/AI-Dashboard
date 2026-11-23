"""Exercise the built dashboard, two private installations, and every advertised client endpoint.
Run from the repository root with Python Playwright and a local Chromium (see docs/WORKOS.md).
"""
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import secrets
import base64
import contextlib
import json
import hashlib
import sqlite3
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from playwright.sync_api import expect, sync_playwright


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, root, name, checkout=None):
        self.directory = root / name
        self.checkout = Path(checkout or Path.cwd()).resolve()
        self.config = json.loads((self.checkout / f"examples/workos/{name}.json").read_text())
        self.config["port"] = free_port()
        self.file = root / f"{name}.json"
        self.write_config()
        self.url = f'http://127.0.0.1:{self.config["port"]}'
        self.proc = None
        self.args = ["node", "scripts/workos.mjs"]
        self.cli("install", self.file)
        self.password = (self.directory / "access").read_text().strip()
        self.cli("index")

    def write_config(self):
        self.file.write_text(json.dumps(self.config))

    def cli(self, action, *args, ok=True):
        result = subprocess.run([*self.args, action, self.directory, *args], capture_output=True, text=True,cwd=self.checkout,timeout=20)
        assert (result.returncode == 0) == ok, (action, result.stderr)
        return result.stdout + result.stderr

    def api(self, path="", body=None, status=200, auth=True, other=None, headers=None, method=None, context=True):
        if context and body is not None and path.startswith("workos/") and self.checkout==Path.cwd():
            body=body.copy()
            state=self.api("workos")
            body.setdefault("planRevision",state["revision"])
            if path in ["workos/read-skill","workos/run","workos/verify"]:
                task=next((t for t in state["tasks"] if t["id"]==body.get("task")),{})
                body.setdefault("expectedRun",task.get("run") or "unselected")
                body.setdefault("expectedSkill",task.get("selected") or "unselected")
        credential = other or self
        h = {}
        if auth:
            raw = f'{credential.config["client"]}:{credential.password}'.encode()
            h["Authorization"] = "Basic " + base64.b64encode(raw).decode()
        if body is not None:
            h["Content-Type"] = "application/json"
        req = Request(self.url + "/api" + ("/" + path if path else ""),
                      headers={**h, **(headers or {})}, method=method,
                      data=None if body is None else json.dumps(body).encode())
        try:
            response = urlopen(req, timeout=8)
        except HTTPError as err:
            response = err
        with response:
            assert response.status == status, (path, response.status, status)
            if status==503: assert response.headers.get("Retry-After")=="1"
            return json.load(response)

    def start(self):
        self.proc = subprocess.Popen([*self.args, "start", self.directory], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,cwd=self.checkout)
        for _ in range(120):
            if self.proc.poll() is not None:
                raise RuntimeError(self.proc.stdout.read())
            try:
                self.api("bootstrap")
                return
            except OSError:
                time.sleep(.1)
        raise TimeoutError("Installation did not start.")

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()

    def inspect(self, other):
        self.api(auth=False,status=401)
        self.api(other=other,status=401)
        self.api("workos/read-skill",{"task":"missing","planRevision":1,"expectedRun":"none","expectedSkill":"none"},status=404,context=False)
        count = 0
        for ep in self.api()["endpoints"]:
            if ep["method"] != "GET":
                route=ep["path"][5:].replace(":id","dec-fixture")
                self.api(route,{},auth=False,status=401,context=False)
                self.api(route,{},other=other,status=401,context=False)
                continue
            route = ep["path"][5:]
            result = self.api(route)
            assert other.config["name"] not in json.dumps(result)
            self.api(route, other=other, status=401)
            self.api(route, auth=False, status=401)
            count += 1
        assert self.api("workos")["usage"]["executed"] == 0
        for route in ["connections/stripe", "sync", "ai/ask", "room/start", "made/scan", "workspaces/switch",
                      "attention/measure-pilot/comment", "attention/measure-pilot/alert", "reset", "brain"]:
            self.api(route, {}, status=403)
        self.api("oauth/google/callback", status=403)
        self.api("brain?action=browse", status=403)
        self.api("export?workspaceId=" + other.config["client"], status=404)
        assert not self.api("search?q=" + other.config["client"])["results"]
        self.api("workos?days=2", status=400)
        self.api("workos?unknown=fixture", status=400)
        self.api("workos", headers={"Origin": other.url}, status=403)
        self.api("bootstrap", headers={"Host":"other.example"}, status=403)
        self.api("workos/approve", {}, headers={"Content-Type":"text/plain"}, status=415)
        self.api("workos/approve", {"text":"x"*8200}, status=413)
        self.api("workos", method="DELETE", status=405)
        self.api("workos/approve",{},status=400,context=False)
        self.api("workos/approve",{"planRevision":0},status=409)
        self.api("workos?days=7&days=30",status=400)
        self.api("workos/history?revision=5",status=404)
        self.api("decisions/:id",{"outcome":"Closed path"},status=403)
        brain = self.api("brain")
        leaf = next(n for n in brain["nodes"] if n["kind"] == "file")
        assert self.config["name"] in json.dumps(self.api("brain?action=node&id="+leaf["id"]))
        other.api("brain?action=node&id="+leaf["id"], status=404)
        self.cli("install", self.file, ok=False)
        return count


def exercise_browser(browser, a):
    ctx = browser.new_context(http_credentials={"username":a.config["client"],"password":a.password}, reduced_motion="reduce")
    # Legacy preview globals have no authority over a real WorkOS installation.
    ctx.add_init_script("window.__KEYSTONE_LOCAL__ = () => { throw new Error('unexpected desktop preview'); };")
    page = ctx.new_page()
    page.set_default_timeout(8000)
    errors, external = [], []
    page.on("pageerror", lambda err: errors.append(str(err)))
    def network(route):
        if route.request.url.startswith(a.url + "/"):
            route.continue_()
        else:
            external.append(route.request.url.split("?")[0])
            route.abort()
    ctx.route("**/*", network)
    page.goto(a.url + "/#workos")
    expect(page.get_by_role("heading", name="Goal and daily queue")).to_be_visible()
    expect(page.get_by_text(a.config["name"], exact=True)).to_be_visible()
    page.get_by_role("button", name="Approve goal").click()
    first = page.get_by_role("article").first
    first.get_by_label("Observed value").fill("16")
    first.get_by_label("Evidence ID", exact=True).fill("pilot-check-01")
    first.get_by_role("button", name="Save measurement").click()
    first.get_by_label("Task request").fill("Send my report externally")
    first.get_by_role("button", name="Find approved skill").click()
    expect(first.get_by_role("status")).to_contain_text("Request did not match a supported local operation")
    first.get_by_label("Task request").fill("How does our actual review turnaround stack up against the agreed target?")
    first.get_by_role("button", name="Find approved skill").click()
    first.get_by_role("button",name="Open selected skill record").click()
    expect(first.get_by_role("region",name="Selected skill record")).to_be_visible()
    first.get_by_role("button",name="Open selected skill record").click()
    assert a.api("workos")["usage"]["opened"]==1
    if out:=os.environ.get("WORKOS_SCREENSHOTS"):
        Path(out).mkdir(parents=True,exist_ok=True)
        page.screenshot(path=Path(out)/"skill-record.png",full_page=True)
    run_button=first.get_by_role("button",name="Run local calculation")
    find_button=first.get_by_role("button",name="Find approved skill")
    first.get_by_label("Task request").fill("Send the new numbers by email")
    expect(run_button).to_be_disabled()
    expect(first.get_by_role("status")).to_contain_text("Confirm this request")
    expect(first.get_by_role("region",name="Selected skill record")).to_have_count(0)
    first.get_by_label("Task request").fill("Actual against the goal")
    find_button.click()
    expect(run_button).to_be_enabled()
    first.get_by_label("Skill revision").select_option("workos.goal-checkin@1.0.0")
    expect(run_button).to_be_disabled()
    find_button.click()
    expect(run_button).to_be_enabled()
    first.get_by_label("Observed value").fill("17")
    expect(run_button).to_be_disabled()
    expect(find_button).to_be_disabled()
    expect(first.get_by_role("status")).to_contain_text("Save the measurement")
    first.get_by_label("Observed value").fill("16")
    expect(find_button).to_be_enabled()
    expect(run_button).to_be_disabled()
    find_button.click()
    expect(run_button).to_be_enabled()
    first.get_by_label("Evidence ID",exact=True).fill("changed-evidence")
    expect(run_button).to_be_disabled()
    expect(find_button).to_be_disabled()
    first.get_by_label("Evidence ID",exact=True).fill("pilot-check-01")
    find_button.click()
    expect(run_button).to_be_enabled()
    page.reload()
    expect(run_button).to_be_disabled()
    assert a.api("workos")["usage"]["executed"]==0
    find_button.click()
    expect(run_button).to_be_enabled()
    first.get_by_role("button", name="Run local calculation").click()
    expect(first.get_by_text("Receipt awaiting review", exact=True)).to_be_visible()
    first.get_by_label("Confirm evidence ID after review").fill("incorrect")
    first.get_by_role("button", name="Verify receipt").click()
    expect(first.get_by_role("status")).to_contain_text("must match")
    first.get_by_label("Confirm evidence ID after review").fill("pilot-check-01")
    first.get_by_role("button", name="Verify receipt").click()
    expect(first.get_by_text("Verified receipt", exact=True)).to_be_visible()
    page.get_by_role("link", name="Skill usage", exact=True).click()
    expect(page.get_by_role("heading",name="Historical catalogue evidence")).to_be_visible()
    expect(page.get_by_text("2 matched observations · 1 unresolved")).to_be_visible()
    page.get_by_text("Imported revisions",exact=True).click()
    page.get_by_role("button",name="coverage · 999999999999").click()
    expect(page.get_by_text("Evaluation source unavailable",exact=False).first).to_be_visible()
    page.get_by_role("button",name="coverage · 111111111111").click()
    expect(page.get_by_role("heading",name="Evidence changes since the previous revision")).to_be_visible()
    expect(page.get_by_text("bounded-synthetic-pass → independently-evaluated-offline-example · 1")).to_be_visible()
    page.get_by_role("button",name="usage · 222222222222").click()
    expect(page.get_by_role("heading",name="usage revision")).to_be_visible()
    unknown=page.get_by_role("listitem").filter(has=page.get_by_text("fixture.note",exact=True))
    expect(unknown.get_by_text("Missing instruction hash")).to_be_visible()
    expect(unknown.get_by_text("Stated uses · Unknown",exact=False)).to_be_visible()
    matched=page.get_by_role("listitem").filter(has=page.get_by_text("Read requests · 7",exact=False))
    matched.get_by_text("Identity evidence").click()
    expect(matched.get_by_text("Local canonical ID")).to_be_visible()
    expect(page.get_by_label("Compare with coverage revision")).to_have_value("1"*40)
    page.set_viewport_size({"width":390,"height":844})
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.set_viewport_size({"width":1280,"height":900})
    if out:=os.environ.get("WORKOS_SCREENSHOTS"):
        page.get_by_role("heading",name="Historical catalogue evidence").scroll_into_view_if_needed()
        page.get_by_role("heading",name="Historical catalogue evidence").locator("..").screenshot(path=Path(out)/"historical-evidence.png")
    page.get_by_label("Period",exact=True).select_option("30")
    expect(page.get_by_text("verified · measure-pilot", exact=True)).to_be_visible()
    page.get_by_text("executed · measure-pilot", exact=True).click()
    expect(page.get_by_text("Local execution took", exact=False)).to_be_visible()
    page.get_by_role("link", name="Metrics", exact=True).click()
    expect(page.get_by_text("16 hours",exact=True)).to_be_visible()
    expect(page.get_by_text("12 hours",exact=True)).to_be_visible()
    page.get_by_role("button", name="Review turnaround",exact=False).click()
    expect(page.get_by_text("Synthetic QA ledger",exact=True)).to_be_visible()
    page.get_by_role("link", name="Skills",exact=True).click()
    expect(page.get_by_role("heading",name="Goal check-in",exact=True)).to_be_visible()
    page.get_by_role("searchbox").fill("unrelated")
    expect(page.get_by_text("No skills match this search.")).to_be_visible()
    page.get_by_role("searchbox").fill("calculator")
    page.get_by_text("Review and provenance",exact=True).first.click()
    expect(page.locator("details[open]").get_by_text("Implementation:",exact=False)).to_be_visible()
    page.get_by_role("link",name="Second Brain",exact=True).click()
    expect(page.get_by_role("heading",name="Second Brain")).to_be_visible()
    page.get_by_role("button", name="WorkOS.md",exact=False).first.click()
    expect(page.get_by_text("What it says",exact=True)).to_be_visible()
    page.get_by_role("link",name="Decision Room",exact=True).click()
    page.get_by_label("What are you deciding?").fill("Should the synthetic team repeat this check?")
    page.get_by_role("button",name="Hear the advisors").click()
    page.get_by_label("What did you decide?").fill("Repeat the local measurement")
    page.get_by_role("button",name="Save decision").click()
    expect(page.get_by_text("Decided: Repeat the local measurement",exact=False).first).to_be_visible()
    page.get_by_role("link",name="Team queue",exact=True).click()
    expect(page.get_by_role("heading",name=a.config["owner"])).to_be_visible()
    page.set_viewport_size({"width":390,"height":844})
    page.get_by_role("link",name="Daily queue",exact=True).click()
    expect(page.get_by_role("heading",name="Daily actions")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Horizontal overflow at phone width"
    if os.environ.get("WORKOS_SCREENSHOTS"):
        out = Path(os.environ["WORKOS_SCREENSHOTS"])
        out.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=out/"queue-mobile.png",full_page=True)
        page.set_viewport_size({"width":1280,"height":900})
        page.screenshot(path=out/"queue-desktop.png",full_page=True)
    assert not external, ("Attempted external browser requests", external)
    assert not errors, errors
    ctx.close()


def exercise_planning(browser, a):
    ctx=browser.new_context(http_credentials={"username":a.config["client"],"password":a.password},reduced_motion="reduce")
    errors,external=[],[]
    def net(route):
        if route.request.url.startswith(a.url+"/"):
            route.continue_()
        else:
            external.append(route.request.url.split("?")[0])
            route.abort()
    ctx.route("**/*",net)
    page=ctx.new_page()
    page.set_default_timeout(8000)
    page.on("pageerror",lambda err:errors.append(str(err)))
    page.goto(a.url+"/#planner")
    page.get_by_role("button",name="New quarterly goal").click()
    page.get_by_role("button",name="Draft steps from goal").click()
    expect(page.locator("form").get_by_role("alert")).to_contain_text("Complete the quarterly")
    for label,value in [("Quarterly goal","Shorten intake"),("Accountable owner","Fixture lead"),("Quarter deadline","2027-01-04"),("Metric","Lead time"),("Unit","hours"),("Baseline","18"),("Target","10"),("Measurement source","Simulated ledger")]:
        page.get_by_label(label,exact=True).fill(value)
    page.get_by_role("button",name="Draft steps from goal").click()
    task=page.get_by_role("group",name="Daily action 2",exact=True)
    task.get_by_label("Title",exact=True).fill("Check end-of-period intake")
    task.get_by_label("Owner",exact=True).fill("Intake lead")
    deadline=task.get_by_label("Due date",exact=True)
    assert deadline.get_attribute("min")=="2026-12-28"
    deadline.fill("2026-12-01")
    assert not deadline.evaluate("e=>e.validity.valid")
    page.get_by_role("button",name="Archive current plan and save goal").click()
    assert a.api("workos")["plan"]["quarter"]["title"]=="Reduce review turnaround"
    deadline.fill("2027-01-04")
    page.get_by_role("button",name="Archive current plan and save goal").click()
    expect(page.get_by_role("heading",name="Shorten intake",exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_text("Check end-of-period intake",exact=False)).to_be_visible()
    page.get_by_role("button",name="Reduce review turnaround · Revision 1").click()
    expect(page.get_by_text("Verified receipt pilot-check-01",exact=False)).to_be_visible()
    page.set_viewport_size({"width":390,"height":844})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    if out:=os.environ.get("WORKOS_SCREENSHOTS"):
        page.screenshot(path=Path(out)/"planner-mobile.png",full_page=True)
    page.set_viewport_size({"width":1280,"height":900})
    if out: page.screenshot(path=Path(out)/"planner-desktop.png",full_page=True)
    page.get_by_role("link",name="Daily queue").click()
    page.get_by_role("button",name="Approve goal").click()
    articles=page.get_by_role("article")
    expect(articles.first.get_by_label("Task request")).to_be_visible()
    prerequisite_title=articles.first.get_by_role("heading",level=3).inner_text()
    expect(articles.nth(1).get_by_text("Waiting for "+prerequisite_title,exact=True)).to_be_visible()
    articles.first.get_by_text("Task options").click()
    articles.first.get_by_role("button",name="Cancel this task").click()
    expect(articles.nth(1).get_by_text("Prerequisite cancelled ("+prerequisite_title+")",exact=False)).to_be_visible()
    articles.nth(1).get_by_text("Task options").click()
    articles.nth(1).get_by_role("button",name="Cancel this task").click()
    expect(articles.nth(1).get_by_text("Cancelled",exact=True)).to_be_visible()
    page.get_by_role("link",name="Linear rehearsal").click()
    page.get_by_role("button",name="Load sample batch").click()
    page.get_by_role("button",name="Reconcile batch").click()
    expect(page.get_by_role("main").get_by_role("status")).to_contain_text("Created 1")
    page.get_by_role("button",name="Reconcile batch").click()
    expect(page.get_by_role("main").get_by_role("status")).to_contain_text("Unchanged 1")
    if out: page.screenshot(path=Path(out)/"linear-rehearsal.png",full_page=True)
    page.get_by_role("link",name="Daily queue").click()
    page.get_by_role("button",name="Approve goal").click()
    imported=page.get_by_role("article").filter(has=page.get_by_role("heading",name="Review synthetic intake"))
    imported.get_by_label("Task request").fill("How many days have we got left on this action item?")
    imported.get_by_role("button",name="Find approved skill").click()
    imported.get_by_role("button",name="Run local skill").click()
    expect(imported.get_by_text("calendar days",exact=False)).to_be_visible()
    task=a.api("workos")["tasks"][-1]
    imported.get_by_label("Confirm evidence ID after review").fill(task["id"])
    imported.get_by_role("button",name="Verify receipt").click()
    expect(imported.get_by_text("Reviewed with installation credential",exact=False)).to_be_visible()
    assert a.api("metrics")["metrics"][0]["current"] is None
    page.get_by_role("link",name="Goal planner",exact=True).click()
    page.get_by_role("button",name="Edit plan").click()
    page.get_by_role("button",name="Add daily action").click()
    extra=page.get_by_role("group",name="Daily action 4",exact=True)
    extra.get_by_label("Title",exact=True).fill("Prepare intake handoff")
    page.get_by_role("button",name="Save proposed changes").click()
    expect(page.get_by_role("button",name="Edit plan")).to_be_visible()
    page.get_by_role("link",name="Daily queue").click()
    page.get_by_role("button",name="Approve goal").click()
    extra=page.get_by_role("article").filter(has=page.get_by_role("heading",name="Prepare intake handoff"))
    extra.get_by_label("Observed value").fill("14")
    extra.get_by_label("Evidence ID",exact=True).fill("intake-14")
    extra.get_by_role("button",name="Save measurement").click()
    compound="For this item, how many calendar days separate today from its due date? Separately, jot a local note from the proof for its reviewer."
    extra.get_by_label("Task request").fill(compound)
    extra.get_by_role("button",name="Find approved skill").click()
    expect(extra.get_by_role("status")).to_contain_text("Multiple approved matches")
    choices=extra.get_by_role("group",name="Choose a matching operation")
    expect(choices.get_by_role("button")).to_have_count(2)
    expect(choices.get_by_role("button",name="Use Deadline review 1.0.0")).to_be_visible()
    choices.get_by_role("button",name="Use Evidence handoff 1.0.0").click()
    expect(extra.get_by_label("Task request")).to_have_value(compound)
    assert not next(t for t in a.api("workos")["tasks"] if t["title"]=="Prepare intake handoff")["selected"]
    if out:=os.environ.get("WORKOS_SCREENSHOTS"):
        choices.screenshot(path=Path(out)/"mixed-choice.png")
    extra.get_by_role("button",name="Find approved skill").click()
    extra.get_by_role("button",name="Run local skill").click()
    expect(extra.get_by_text("Evidence intake-14 records 14 hours",exact=False)).to_be_visible()
    extra.get_by_label("Confirm evidence ID after review").fill("intake-14")
    extra.get_by_role("button",name="Verify receipt").click()
    expect(extra.get_by_text("Verified receipt",exact=True)).to_be_visible()
    assert a.api("metrics")["metrics"][0]["current"] is None
    page.get_by_role("link",name="Skill usage").click()
    expect(page.get_by_role("heading",name="By skill revision")).to_be_visible()
    for label in ["verified","unused","review","executed"]:
        page.get_by_label("Show skills").select_option(label)
    expect(page.get_by_role("heading",name="Daily usage")).to_be_visible()
    page.get_by_role("link",name="Daily queue",exact=True).click()
    extra=page.get_by_role("article").filter(has=page.get_by_role("heading",name="Prepare intake handoff",exact=True))
    extra.get_by_text("Routing decision",exact=True).click()
    expect(extra.get_by_text("Required grants",exact=False)).to_be_visible()
    assert not errors and not external,(errors,external)
    print("PASS: new goal, draft, edit, archive, mobile planner, dependency cancellation, duplicate fixture replay, calendar and handoff receipts",flush=True)
    ctx.close()


AXE_RULES={"runOnly":{"type":"tag","values":["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]},"resultTypes":["violations"]}


def axe_violations(page):
    """Run the pinned axe-core release against the current page (WCAG 2.2 A/AA rules)."""
    page.evaluate((Path.cwd()/"node_modules/axe-core/axe.min.js").read_text()+";0")
    return page.evaluate("o=>axe.run(document,o).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target.join(' '))})))",AXE_RULES)


def navigation_rehearsal(browser,client):
    context=browser.new_context(viewport={"width":390,"height":844},reduced_motion="reduce",
        http_credentials={"username":client.config["client"],"password":client.password})
    page=context.new_page()
    errors,external=[],[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    def net(route):
        if route.request.url.startswith(client.url+"/"):
            route.continue_()
        else:
            external.append(route.request.url.split("?")[0])
            route.abort()
    context.route("**/*",net)
    page.goto(client.url+"/#workos")
    expect(page.get_by_role("heading",name="Goal and daily queue")).to_be_visible()
    page.keyboard.press("Tab")
    expect(page.get_by_role("link",name="Skip to content")).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.get_by_role("main")).to_be_focused()
    nav=page.get_by_role("navigation",name="WorkOS pages")
    links=nav.get_by_role("link").all()
    for link in links:
        label=link.inner_text()
        link.focus()
        page.keyboard.press("Enter")
        expect(link).to_have_attribute("aria-current","page")
        expect(page.get_by_role("main").get_by_role("heading",level=1)).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),label
        assert not (found:=axe_violations(page)),(label,"390px",found)
    page.set_viewport_size({"width":1280,"height":900})
    for link in links:
        label=link.inner_text()
        link.click()
        expect(link).to_have_attribute("aria-current","page")
        expect(page.get_by_role("main").get_by_role("heading",level=1)).to_be_visible()
        assert not (found:=axe_violations(page)),(label,"1280px",found)
    page.set_viewport_size({"width":390,"height":844})
    page.goto(client.url+"/#connections")
    expect(page.get_by_text("This page is unavailable",exact=False)).to_be_visible()
    page.get_by_role("link",name="Open daily queue").click()
    expect(page.get_by_role("heading",name="Goal and daily queue")).to_be_visible()
    assert not errors and not external,(errors,external)
    context.close()
    print(f"PASS: {client.config['client']} keyboard navigation, skip link, unavailable-page recovery, mobile width and zero axe-core WCAG 2.2 AA violations at 390px and 1280px on {len(links)} visible pages",flush=True)


def migration_rehearsal(root,cleanup):
    area=root/"migration"
    area.mkdir()
    c=Client(area,"alder")
    cleanup.callback(c.stop)
    # Construct the published schema-1 layout using fictional rows in a separate directory.
    current=c.directory
    c.directory=area/"legacy"
    c.directory.mkdir(mode=0o700)
    shutil.copy2(current/"access",c.directory/"access")
    shutil.copytree(current/"project",c.directory/"project")
    c.config.pop("availableTools")
    c.config["permissions"]=["goals.read","receipts.write"]
    c.config["enabledSkills"]=["workos.goal-checkin@1.0.0"]
    c.write_config()
    before="schema 1 fixture"
    legacy_file=c.directory/"workos.sqlite"
    with contextlib.closing(sqlite3.connect(legacy_file)) as db:
        db.executescript("""
            CREATE TABLE installation(config TEXT NOT NULL,previous TEXT,approved INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE tasks(id TEXT PRIMARY KEY,value REAL,reference TEXT,run TEXT UNIQUE,selected TEXT,failure TEXT,receipt TEXT,verified INTEGER,cancelled INTEGER DEFAULT 0);
            CREATE TABLE events(id TEXT PRIMARY KEY,run TEXT NOT NULL,task TEXT NOT NULL,stage TEXT NOT NULL,reason TEXT,revision TEXT,at INTEGER NOT NULL,duration REAL);
            CREATE INDEX event_time ON events(at);
            CREATE TABLE decisions(id TEXT PRIMARY KEY,record TEXT NOT NULL);
            PRAGMA user_version=1;""")
        db.execute("INSERT INTO installation(config,approved) VALUES(?,1)",(json.dumps(c.config),))
        pin=c.config["enabledSkills"][0]
        now=int(time.time()*1000)
        record={"revision":pin,"reference":"legacy-14","at":now,"reviewer":"Rowan","progress":83}
        db.execute("INSERT INTO tasks(id,value,reference,run,selected,receipt,verified) VALUES(?,14,?,?,?,?,?)",("measure-pilot","legacy-14","fixture-run",pin,json.dumps(record),now))
        db.execute("INSERT INTO tasks(id) VALUES('repeat-check')")
        db.commit()
    legacy_file.chmod(0o600)
    c.cli("start",ok=False)
    c.cli("upgrade")
    c.cli("upgrade")
    backup=c.directory/"before-schema-3.sqlite"
    assert backup.is_file()
    c.start()
    after=c.api()["version"]
    assert after!=before
    state=c.api("workos")
    legacy=state["tasks"][0]["receipt"]
    assert state["tasks"][0]["verified"] and legacy["legacyOwnerLabel"]=="Rowan" and "reviewer" not in legacy and "reviewedByPrincipal" not in legacy
    assert [s["name"] for s in state["catalog"] if s["enabled"]]==["Goal check-in"]
    assert not state["editable"] and not state["canImport"]
    c.api("workos/measure",{"task":"repeat-check","value":12,"reference":"after-upgrade"})
    c.stop()
    active=c.directory
    restored=area/"rollback-copy"
    shutil.copytree(active,restored)
    shutil.copyfile(backup,restored/"workos.sqlite")
    with contextlib.closing(sqlite3.connect((restored/"workos.sqlite").as_uri()+"?mode=ro",uri=True)) as db:
        assert db.execute("PRAGMA integrity_check").fetchone()==("ok",)
        assert db.execute("PRAGMA user_version").fetchone()==(1,)
        assert db.execute("SELECT reference FROM tasks WHERE id='measure-pilot'").fetchone()==("legacy-14",)
        assert db.execute("SELECT reference FROM tasks WHERE id='repeat-check'").fetchone()==(None,)
    c.directory=restored
    c.cli("start",ok=False)
    c.directory=active
    c.start()
    assert c.api("workos")["tasks"][1]["reference"]=="after-upgrade"
    c.stop()
    c.config["enabledSkills"]=["workos.goal-checkin@1.1.0"]
    c.config["deprecatedSkills"]=["workos.goal-checkin@1.0.0"]
    c.write_config()
    c.cli("update",c.file)
    c.start()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or shutil.which("chromium") or None)
        ctx=browser.new_context(http_credentials={"username":c.config["client"],"password":c.password})
        ctx.route("**/*",lambda r:r.continue_() if r.request.url.startswith(c.url+"/") else r.abort())
        page=ctx.new_page()
        page.goto(c.url+"/#workos")
        t=page.get_by_role("article").nth(1)
        t.get_by_label("Task request").fill("Calculate our progress in percent.")
        t.get_by_role("button",name="Find approved skill").click()
        t.get_by_role("button",name="Run local skill").click()
        expect(t.get_by_text("Distance from baseline to target covered: 100%",exact=True)).to_be_visible()
        t.get_by_label("Confirm evidence ID after review").fill("after-upgrade")
        t.get_by_role("button",name="Verify receipt").click()
        expect(t.get_by_text("Verified receipt",exact=True)).to_be_visible()
        page.get_by_role("link",name="Skills",exact=True).click()
        expect(page.get_by_text("Deprecated",exact=True)).to_be_visible()
        browser.close()
    c.stop()
    c.cli("rollback")
    c.start()
    assert c.api("workos")["tasks"][1]["receipt"]["revision"]=="workos.goal-checkin@1.1.0"
    assert c.api("workos")["catalogue"]["enabled"]
    c.stop()
    print("PASS: explicit catalogue version update, browser invocation at 1.1.0, deprecated 1.0.0 and overlay rollback with historic receipt",flush=True)
    print(f"PASS: stopped schema-1 installation {before} → {after}, backup rollback to {before}, forward restore to {after} with newer data retained",flush=True)


def backup_rehearsal(root,a):
    """Back up a running installation, restore it to a new directory and serve the same records."""
    assert a.proc and a.proc.poll() is None
    before=a.api("workos")
    saved=root/"alder-online-backup"
    a.cli("backup",saved)
    manifest=json.loads((saved/"backup.json").read_text())
    assert manifest["client"]=="alder-demo" and manifest["schema"]==3
    restored=root/"alder-restored"
    a.stop()
    out=subprocess.run(["node","scripts/workos.mjs","restore",saved,restored],capture_output=True,text=True,cwd=a.checkout,timeout=20)
    assert out.returncode==0 and "Run index next" in out.stdout,out.stderr
    live=a.directory
    a.directory=restored
    try:
        a.cli("index")
        a.start()
        after=a.api("workos")
        assert after["revision"]==before["revision"]
        assert [t["id"] for t in after["tasks"]]==[t["id"] for t in before["tasks"]]
        assert [t.get("verified") for t in after["tasks"]]==[t.get("verified") for t in before["tasks"]]
        assert len(after["usage"]["events"])==len(before["usage"]["events"])
        a.stop()
    finally:
        a.directory=live
    a.start()
    print("PASS: online backup of a running installation, manifest-checked restore to a new directory, reindex and identical plan, receipts and usage",flush=True)


def mcp_rehearsal(a,b):
    def rpc(directory,messages):
        proc=subprocess.run(["node","mcp/server.mjs",str(directory)],text=True,capture_output=True,
            input="".join(json.dumps({"jsonrpc":"2.0","id":i+1,**request})+"\n" for i,request in enumerate(messages)),timeout=15)
        assert proc.returncode==0
        return list(map(json.loads,proc.stdout.splitlines()))
    def call(name,args):
        return {"method":"tools/call","params":{"name":name,"arguments":args}}
    def content(response):
        return json.loads(response["result"]["content"][0]["text"])
    target=next(t for t in a.api("workos")["tasks"] if t["verified"] and t["receipt"])
    def checksum(c):
        return hashlib.sha256((c.directory/"workos.sqlite").read_bytes()).digest()
    prior=[checksum(a),checksum(b)]
    listing,queue,handoff,rejected=rpc(a.directory,[{"method":"tools/list"},call("workos_queue",{}),call("workos_handoff",{"task":target["id"]}),call("send",{})])
    assert [t["name"] for t in listing["result"]["tools"]]==["workos_queue","workos_handoff"]
    assert content(queue)["installation"]==a.config["client"]
    brief=content(handoff)
    assert brief["contract"]=="workos.local-handoff/v1" and brief["receipt"]==target["receipt"] and brief["pin"]==target["selected"] and brief["owner"]==target["owner"]
    assert "error" in rejected
    assert rpc(b.directory,[call("workos_handoff",{"task":target["id"]})])[0]["result"]["isError"]
    assert prior==[checksum(a),checksum(b)]
    print("PASS: local read-only MCP queue, versioned receipt handoff, foreign task rejection and unchanged database bytes",flush=True)


def named_account_rehearsal(root,cleanup,browser,foreign):
    area=root/"member-journey"
    area.mkdir()
    client=Client(area,"alder")
    cleanup.callback(client.stop)
    members={}
    for name,role in [("rita","reviewer"),("oliver","operator"),("vivi","viewer")]:
        key=secrets.token_hex(32)
        args=["node","scripts/workos.mjs","member-add",str(client.directory),name,role]
        for _ in range(2):
            r=subprocess.run(args,input=key+"\n",text=True,capture_output=True,timeout=10)
            assert r.returncode==0 and key not in r.stdout+r.stderr
        members[name]=SimpleNamespace(config={"client":client.config["client"]+"/"+name},password=key)
    client.start()
    reviewer,worker,viewer=[members[n] for n in ("rita","oliver","vivi")]
    def api(auth,route,body=None,status=200):
        return client.api(route,body,other=auth,status=status,context=False)
    assert not [e for e in api(viewer,"")["endpoints"] if e["method"]=="POST"]
    assert [e["path"] for e in api(reviewer,"")["endpoints"] if e["method"]=="POST"]==["/api/workos/approve","/api/workos/verify","/api/workos/review-work"]
    for endpoint in client.api()["endpoints"]:
        route=endpoint["path"][5:].replace(":id","dec-test")
        if endpoint["method"]=="POST":
            api(viewer,route,{},403)
            if route not in ["workos/approve","workos/verify","workos/review-work"]:
                api(reviewer,route,{},403)
        else:
            api(viewer,route)
    foreign.api("workos",other=reviewer,status=401)
    def page_for(who):
        ctx=browser.new_context(http_credentials={"username":who.config["client"],"password":who.password})
        page=ctx.new_page()
        page.goto(client.url+"/#workos")
        expect(page.get_by_text("Signed in as "+who.config["client"],exact=False)).to_be_visible()
        return page
    rp=page_for(reviewer)
    rp.get_by_role("button",name="Approve goal").click()
    expect(rp.get_by_text("Approved with named account "+reviewer.config["client"],exact=False)).to_be_visible()
    expect(rp.get_by_label("Task request")).to_have_count(0)
    wp=page_for(worker)
    article=wp.get_by_role("article").first
    article.get_by_label("Observed value").fill("14")
    article.get_by_label("Evidence ID",exact=True).fill("roles-14")
    article.get_by_role("button",name="Save measurement").click()
    article.get_by_label("Task request").fill("Review goal progress")
    article.get_by_role("button",name="Find approved skill").click()
    expect(article.get_by_role("button",name="Run local calculation")).to_be_visible()
    selected=api(worker,"workos")["tasks"][0]
    params={"task":selected["id"],"expectedRun":selected["run"],"expectedSkill":selected["selected"],"planRevision":1}
    with contextlib.closing(sqlite3.connect(client.directory/"workos.sqlite")) as writer:
        writer.execute("BEGIN IMMEDIATE")
        assert "busy" in api(worker,"workos/run",params,503)["error"]
        writer.rollback()
    with ThreadPoolExecutor(max_workers=6) as pool:
        outcomes=list(pool.map(lambda _:api(worker,"workos/run",params),range(12)))
    assert all(r==outcomes[0] for r in outcomes) and outcomes[0]["principal"]==worker.config["client"]
    assert len(outcomes[0]["instructionHash"])==64
    role_state=api(viewer,"workos")
    assert role_state["usage"]["executed"]==1 and role_state["usage"]["loaded"]==1 and role_state["usage"]["verified"]==0
    vp=page_for(viewer)
    expect(vp.get_by_role("button",name="Verify receipt")).to_have_count(0)
    vp.get_by_role("link",name="Decision Room").click()
    expect(vp.get_by_role("button",name="Hear the advisors")).to_have_count(0)
    rp.reload()
    reviewed=rp.get_by_role("article").first
    reviewed.get_by_label("Confirm evidence ID after review").fill("roles-14")
    reviewed.get_by_role("button",name="Verify receipt").click()
    expect(reviewed.get_by_text("Reviewed with named account "+reviewer.config["client"],exact=False)).to_be_visible()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:api(reviewer,"workos/verify",{**params,"reference":"roles-14"}),range(8)))
    assert all(x["verified"] for x in results) and api(viewer,"workos")["usage"]["verified"]==1
    wp.get_by_role("link",name="Goal planner",exact=True).click()
    wp.get_by_role("button",name="New quarterly goal").click()
    for label,value in [("Quarterly goal","Review intake across the quarter"),("Quarter deadline","2028-03-31"),("Metric","Turnaround"),("Unit","hours"),("Baseline","18"),("Target","10"),("Measurement source","Synthetic counters")]:
        wp.get_by_label(label,exact=True).fill(value)
    wp.get_by_label("Draft schedule").select_option("weekly")
    wp.get_by_label("Measurement start date").fill("2027-10-01")
    wp.get_by_role("button",name="Draft steps from goal").click()
    expect(wp.get_by_role("alert").filter(has_text="92 calendar days")).to_be_visible()
    wp.get_by_label("Measurement start date").fill("2028-01-01")
    wp.get_by_role("button",name="Draft steps from goal").click()
    wp.get_by_role("button",name="Archive current plan and save goal").click()
    expect(wp.get_by_role("heading",name="Review intake across the quarter",exact=True)).to_be_visible()
    state=api(viewer,"workos")
    assert len(state["plan"]["months"])==3 and len(state["tasks"])==17
    assert not state["approved"] and all(not t["verified"] and t["value"] is None for t in state["tasks"])
    pilot_journey(client, wp, rp, worker, reviewer, viewer, api)
    client.cli("member-role","rita","suspended")
    api(reviewer,"workos",status=401)
    client.stop()
    client.start()
    api(reviewer,"workos",status=401)
    assert api(viewer,"workos/history?revision=1")["tasks"][0]["receipt"]["reviewedByPrincipal"]==reviewer.config["client"]
    client.cli("member-role","rita","viewer")
    api(reviewer,"workos/approve",{"planRevision":1},403)
    for page in [rp,wp,vp]:page.context.close()
    client.stop()
    print("PASS: named worker/reviewer/viewer, every prohibited mutation, foreign credential, suspension across restart, writer contention, concurrent idempotent delivery and 17 editable actions across a leap-year quarter",flush=True)


def pilot_journey(client,worker_page,reviewer_page,worker,reviewer,viewer,api):
    p=worker_page
    p.get_by_role("button",name="New quarterly goal").click()
    for label,value in [("Quarterly goal","Reduce intake waiting time"),("Quarter deadline","2028-03-31"),("Metric","Turnaround"),("Unit","hours"),("Baseline","24"),("Target","12"),("Measurement source","Synthetic intake log")]:
        p.get_by_label(label,exact=True).fill(value)
    p.get_by_label("Draft schedule").select_option("pilot")
    p.get_by_label("Measurement start date").fill("2028-01-01")
    p.get_by_label("Work area or cohort").fill("intake review")
    p.get_by_label("Change to test").fill("assign one reviewer at intake")
    p.get_by_role("button",name="Draft steps from goal").click()
    expect(p.get_by_label("Acceptance criterion")).to_have_count(3)
    p.get_by_label("Acceptance criterion").first.fill("The timestamped sample identifies the slowest intake handoff.")
    p.get_by_role("button",name="Archive current plan and save goal").click()
    expect(p.get_by_role("heading",name="Reduce intake waiting time",exact=True)).to_be_visible()
    state=api(viewer,"workos")
    revision=state["revision"]
    assert not state["approved"] and len(state["tasks"])==5
    assert not any(task["verified"] or task["receipt"] for task in state["tasks"])
    reviewer_page.goto(client.url+"/#workos")
    reviewer_page.reload()
    reviewer_page.get_by_role("button",name="Approve goal").click()
    expect(reviewer_page.get_by_text("Approved with named account "+reviewer.config["client"],exact=False)).to_be_visible()
    p.goto(client.url+"/#workos")
    p.reload()
    def article(page,i):
        return page.get_by_role("article").nth(i)
    def review(i,reference,work):
        reviewer_page.reload()
        a=article(reviewer_page,i)
        expect(a.get_by_role("button",name="Submit work product")).to_have_count(0)
        a.get_by_label("Confirm evidence ID after review").fill(reference)
        a.get_by_role("button",name="Verify work product" if work else "Verify receipt",exact=True).click()
        expect(a.get_by_text("Reviewed with named account "+reviewer.config["client"],exact=False)).to_be_visible()
    def observation(i,value,reference,guided=False):
        p.reload()
        a=article(p,i)
        a.get_by_label("Observed value").fill(value)
        a.get_by_label("Evidence ID",exact=True).fill(reference)
        a.get_by_role("button",name="Save measurement").click()
        if guided:
            a.get_by_label("Task request").fill("Forecast the next reading and change the target.")
            a.get_by_role("button",name="Find approved skill").click()
            expect(a.get_by_role("button",name="Run local calculation")).to_have_count(0)
            a.get_by_role("button",name="Choose a local output instead").click()
            a.get_by_role("checkbox",name="Measurement comparison in original units").check()
            assert api(viewer,"workos")["tasks"][i]["selected"] is None
            a.get_by_role("button",name="Confirm chosen outputs").click()
        else:
            a.get_by_role("button",name="Find approved skill").click()
        a.get_by_role("button",name="Run local calculation").click()
        expect(a.get_by_text("Receipt awaiting review",exact=True)).to_be_visible()
        review(i,reference,False)
    prior=api(viewer,"workos")["usage"]
    observation(0,"24","pilot-base",True)
    for i in [1,2,3]:
        p.reload()
        a=article(p,i)
        expect(a.get_by_label("Observed value")).to_have_count(0)
        expect(a.get_by_label("Task request")).to_have_count(0)
        reference="pilot-work-"+str(i)
        a.get_by_label("What was produced?").fill("Reviewed synthetic work sample "+str(i))
        a.get_by_label("Work evidence ID").fill(reference)
        a.get_by_role("button",name="Submit work product").click()
        expect(a.get_by_text("Receipt awaiting review",exact=True)).to_be_visible()
        task=api(viewer,"workos")["tasks"][i]
        assert task["receipt"]["principal"]==worker.config["client"] and not task["verified"]
        api(reviewer,"workos/review-work",{"task":task["id"],"reference":"different-id","expectedRun":task["run"],"planRevision":revision},409)
        if i==1 and os.environ.get("WORKOS_SCREENSHOTS"):
            p.set_viewport_size({"width":390,"height":844})
            assert p.evaluate("document.documentElement.scrollWidth<=innerWidth")
            a.screenshot(path=Path(os.environ["WORKOS_SCREENSHOTS"])/"pilot-work-product.png")
            p.set_viewport_size({"width":1280,"height":900})
        review(i,reference,True)
    middle=api(viewer,"workos")
    assert middle["usage"]["executed"]==prior["executed"]+1 and middle["usage"]["verified"]==prior["verified"]+1
    assert middle["queue"]["current"]==middle["tasks"][4]["id"]
    observation(4,"18","pilot-final")
    done=api(viewer,"workos")
    assert all(t["verified"] for t in done["tasks"]) and done["queue"]["current"] is None
    assert done["usage"]["executed"]==prior["executed"]+2 and done["usage"]["verified"]==prior["verified"]+2
    assert done["rollups"][done["plan"]["weeks"][-1]["id"]]["observed"]==18
    assert "pilot-work-2" in json.dumps(api(viewer,"export"))
    print("PASS: goal-specific intake pilot, human-guided recovery after abstention, two verified metric readings and three separately reviewed work products with distinct worker and reviewer credentials",flush=True)


def direct_output_rehearsal(root,cleanup,browser):
    area=root/"multi-output"
    area.mkdir()
    c=Client(area,"alder")
    cleanup.callback(c.stop)
    c.start()
    ctx=browser.new_context(http_credentials={"username":c.config["client"],"password":c.password})
    page=ctx.new_page()
    page.goto(c.url+"/#workos")
    page.get_by_role("button",name="Approve goal").click()
    a=page.get_by_role("article").first
    a.get_by_role("button",name="Choose outputs directly").click()
    calendar=a.get_by_role("checkbox",name="Calendar days to the task due date",exact=False)
    comparison=a.get_by_role("checkbox",name="Measurement comparison in original units",exact=False)
    handoff=a.get_by_role("checkbox",name="Local evidence handoff note",exact=False)
    expect(comparison).to_be_disabled()
    calendar.focus()
    page.keyboard.press("Space")
    expect(calendar).to_be_checked()
    a.get_by_role("button",name="Cancel output choice").click()
    assert c.api("workos")["usage"]["operatorChosen"]==0
    a.get_by_label("Observed value").fill("15")
    a.get_by_label("Evidence ID",exact=True).fill("batch-proof")
    a.get_by_role("button",name="Save measurement").click()
    a.get_by_label("Task request").fill("Send my estimate to a client")
    a.get_by_role("button",name="Find approved skill").click()
    expect(a.get_by_role("status")).to_contain_text("did not match")
    a.get_by_role("button",name="Choose outputs directly").click()
    calendar.check()
    comparison.check()
    handoff.check()
    if out:=os.environ.get("WORKOS_SCREENSHOTS"):
        a.get_by_role("form",name="Choose local outputs").screenshot(path=Path(out)/"choose-outputs.png")
    page.set_viewport_size({"width":390,"height":844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    if out:=os.environ.get("WORKOS_SCREENSHOTS"):
        a.get_by_role("form",name="Choose local outputs").screenshot(path=Path(out)/"choose-outputs-mobile.png")
    a.get_by_role("button",name="Confirm chosen outputs").click()
    run=a.get_by_role("button",name="Run chosen outputs")
    expect(run).to_be_enabled()
    handoff.uncheck()
    expect(run).to_be_disabled()
    handoff.check()
    expect(run).to_be_disabled()
    a.get_by_role("button",name="Confirm chosen outputs").click()
    a.get_by_role("button",name="Open selected skill record").click()
    expect(a.get_by_role("region",name="Selected skill record").get_by_role("heading")).to_have_count(3)
    assert c.api("workos")["usage"]["executed"]==0
    run.click()
    expect(a.get_by_text("Receipt awaiting review",exact=True)).to_be_visible()
    expect(a.get_by_text("3 hours above target.",exact=True)).to_be_visible()
    assert c.api("workos")["usage"]["executed"]==3 and c.api("metrics")["metrics"][0]["current"] is None
    a.get_by_label("Confirm evidence ID for Calendar days to the task due date",exact=True).fill(c.config["tasks"][0]["id"])
    a.get_by_label("Confirm evidence ID for Measurement comparison",exact=False).fill("batch-proof")
    a.get_by_label("Confirm evidence ID for Local evidence handoff note",exact=False).fill("wrong-id")
    a.get_by_role("button",name="Verify receipt").click()
    expect(a.get_by_role("status")).to_contain_text("matching evidence")
    assert c.api("workos")["usage"]["verified"]==0
    a.get_by_label("Confirm evidence ID for Local evidence handoff note",exact=False).fill("batch-proof")
    a.get_by_role("button",name="Verify receipt").click()
    expect(a.get_by_text("Verified receipt",exact=True)).to_be_visible()
    assert c.api("metrics")["metrics"][0]["current"]==15
    ledger=c.api("workos")["usage"]
    assert [ledger[k] for k in ("suggested","operatorChosen","opened","executed","verified")]==[0,3,3,3,3]
    ctx.close()
    c.stop()
    c.start()
    assert len(c.api("workos")["tasks"][0]["receipt"]["additional"])==2
    c.stop()
    print("PASS: explicit manual choice, cancellation, three compound outputs, read-only skill history, refusal of wrong evidence, durable verified measurement and separate usage counters",flush=True)


def application_rehearsal(root,cleanup,baseline):
    baseline=Path(baseline).resolve()
    new=Path.cwd()
    # Both binaries must come from the separate WorkOS Git history.
    def git(directory,*args):
        return subprocess.check_output(["git","-C",directory,*args],text=True).strip()
    # The engineering history (root fbdc9cd) and the published GitHub history (root 4e41649) are separate.
    histories={
        "fbdc9cd5c6b27c19ffc19a6eb41f6b9ce06d29ec":["fbdc9cd5c6b27c19ffc19a6eb41f6b9ce06d29ec","c6c4dd9d535517155c7329db42bfcd7f787f27e3","55ba8ba1805da59db2fb496cbcc2560021e8ed1c","4bce77c7751e9c3b0e26b4b73fb1f83fada25840","c606b5377a76f9eba044099992788d0520e23598","5f52a131e4bf2200d7a6e087f0ff4ab2bfa7b36f","a1ddd00927cf71a341bc9f800ca92aeccc8776b5","f471a96a27c1a9cef83ad811057798230d2dcd1b","abe064d595615782f402d77af8ed42a2353a2dca","deb5877026872cc6b1b66a2c281b6e2c0e60b1b6"],
        "4e416493541dc8975952a6496f89d59a08d349ee":["23ea8265ded0d2c23925fcaf28a1cf86b73afcf0"],
    }
    expected_root=git(new,"rev-list","--max-parents=0","HEAD")
    assert baseline!=new and expected_root in histories and git(baseline,"rev-parse","HEAD") in histories[expected_root] and git(baseline,"rev-list","--max-parents=0","HEAD")==expected_root
    area=root/"application-versions"
    area.mkdir()
    c=Client(area,"alder",baseline)
    cleanup.callback(c.stop)
    c.start()
    previous_version=json.loads((baseline/"package.json").read_text())["version"]
    assert c.api()["version"]==previous_version
    c.api("workos/approve",{"planRevision":1})
    c.api("workos/measure",{"task":"measure-pilot","value":16,"reference":"version-before","planRevision":1})
    c.stop()
    active=c.directory
    saved=area/"stopped-before"
    shutil.copytree(active,saved)
    with contextlib.closing(sqlite3.connect(c.directory/"workos.sqlite")) as db:
        previous_schema=db.execute("PRAGMA user_version").fetchone()[0]
    c.checkout=new
    if previous_schema<3:
        c.cli("upgrade")
        assert (c.directory/"before-schema-3.sqlite").is_file()
        c.checkout=baseline
        assert "Unsupported installation schema" in c.cli("index",ok=False)
    else:
        # Same database schema: the upgrade is a no-op and the stopped snapshot is the rollback point.
        assert "already installed" in c.cli("upgrade")
        assert not (c.directory/"before-schema-3.sqlite").exists()
    c.checkout=new
    c.start()
    assert c.api()["version"]=="0.2.0-review.12" and c.api("workos")["tasks"][0]["reference"]=="version-before"
    c.api("workos/measure",{"task":"measure-pilot","value":15,"reference":"version-after"})
    c.stop()
    if "work.record" not in c.config["permissions"]:
        c.config["permissions"].append("work.record")
        c.write_config()
        c.cli("update",c.file)
    c.start()
    draft=c.api("workos")["plan"]
    draft["tasks"]=[{**draft["tasks"][0],"id":"version-proof","after":None,"evidence":{"kind":"deliverable","criterion":"A synthetic review artifact is present."}}]
    c.api("workos/new-plan",{"plan":draft,"planRevision":1})
    c.api("workos/approve",{"planRevision":2})
    proof=c.api("workos/submit-work",{"task":"version-proof","reference":"version-proof-01","summary":"Synthetic work artifact.","expectedRun":None})
    c.api("workos/review-work",{"task":"version-proof","expectedRun":proof["run"],"reference":"version-proof-01"})
    c.stop()
    c.checkout=baseline
    c.directory=saved
    c.start()
    assert c.api()["version"]==previous_version and c.api("workos")["tasks"][0]["reference"]=="version-before"
    c.stop()
    c.checkout=new
    c.directory=active
    c.start()
    assert c.api()["version"]=="0.2.0-review.12" and c.api("workos/history?revision=1")["tasks"][0]["reference"]=="version-after"
    restored=c.api("workos")["tasks"][0]
    assert restored["verified"] and restored["receipt"]["reference"]=="version-proof-01" and restored["value"] is None
    c.stop()
    print(f"PASS: independent application {previous_version} → 0.2.0-review.12, stopped snapshot rollback to the prior binary and forward restore",flush=True)


def standalone_boundary(root):
    """In client mode, direct Next requests must never expose the owner dashboard's API or touch its state.
    (Without WORKOS_LOCAL_CLIENT the same server is the owner dashboard, which has its own tests.)"""
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    desktop = root/"desktop"
    desktop.mkdir()
    env = {"HOME":str(desktop),"KEYSTONE_HOME":str(desktop/"data"),"PATH":str(desktop),
           "NEXT_TELEMETRY_DISABLED":"1","NODE_ENV":"production","WORKOS_LOCAL_CLIENT":"1"}
    proc=subprocess.Popen([shutil.which("node"),"node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",str(port)],
                          env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    def call(path,body=None,status=200):
        req=Request(base+path,headers={"Content-Type":"application/json"},data=json.dumps(body).encode() if body is not None else None)
        try:
            result=urlopen(req,timeout=12)
        except HTTPError as e:
            result=e
        with result:
            assert result.status==status,(path,result.status,status)
            return json.load(result)
    try:
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError(proc.stdout.read())
            try:
                call("/api",status=403)
                break
            except OSError:
                time.sleep(.1)
        else:
            raise TimeoutError("Bare WorkOS server did not start.")
        for name in ["bootstrap","brain","workos","export","room","ai/status","connections/stripe"]:
            call("/api/"+name,status=403)
            call("/api/"+name,{},403)
        call("/api/firstrun/start",{},403)
        call("/ui/app.js",status=403)
        assert not (desktop/"data").exists()
        print("PASS: bare Next entry point refuses desktop reads/writes and creates no dashboard data",flush=True)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def main():
    with tempfile.TemporaryDirectory(prefix="workos-review-") as temp, contextlib.ExitStack() as cleanup:
        standalone_boundary(Path(temp))
        a, b = [Client(Path(temp), name) for name in ["alder","birch"]]
        credential=a.directory/"access"
        credential.chmod(0o644)
        try:
            a.cli("start",ok=False)
        finally:
            credential.chmod(0o600)
        for sample in ["coverage","usage"]:
            data=Path.cwd()/f"examples/workos/history/{sample}.json"
            if sample=="coverage":
                current=json.loads(data.read_text())
                prior=json.loads(data.read_text())
                prior["revision"]="9"*40
                prior["evaluations"]=None
                prior["coverage"]["definitions"][0]["status"]="bounded-synthetic-pass"
                prior_file=Path(temp)/"historic-coverage.json"
                prior_file.write_text(json.dumps(prior))
                a.cli("catalogue-import",prior_file)
                current["previous"]=prior["revision"]
                data=Path(temp)/"reviewed-coverage.json"
                data.write_text(json.dumps(current))
            a.cli("catalogue-import",data)
            a.cli("catalogue-import",data)
            b.cli("catalogue-import",data,ok=False)
        invalid=Path(temp)/"unreadable-metadata.json"
        invalid.write_text("{invalid JSON")
        a.cli("catalogue-import",invalid,ok=False)
        linked=Path(temp)/"metadata-link"
        linked.symlink_to(Path.cwd()/"examples/workos/history/usage.json")
        a.cli("catalogue-import",linked,ok=False)
        for c in [a,b]:
            cleanup.callback(c.stop)
            c.start()
        for c, other in [(a,b),(b,a)]:
            reads=c.inspect(other)
            print(f'{c.config["client"]}: {reads} advertised GET endpoints plus manifest; {len(c.api()["endpoints"])+1} authenticated method/path entries checked',flush=True)
        b.api("workos/catalogue-history",status=403)
        a.api("workos/catalogue-history?source=usage",status=400)
        history=a.api("workos/catalogue-history")
        assert len(history["snapshots"])==3 and history["usage"]["exactMatches"]==2
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or shutil.which("chromium") or None)
            exercise_browser(browser,a)
            browser.close()
        first = a.api("workos")
        assert first["usage"]["verified"] == first["usage"]["executed"] == 1
        assert first["tasks"][0]["receipt"]["reviewedByPrincipal"] == a.config["client"]
        assert "reviewer" not in first["tasks"][0]["receipt"]
        assert first["queue"] == {"current":"repeat-check","next":None}
        assert a.api("metrics")["metrics"][0]["current"] == 16
        assert b.api("metrics")["metrics"][0]["current"] is None
        assert b.api("workos")["usage"]["executed"] == 0
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or shutil.which("chromium") or None)
            ctx=browser.new_context(http_credentials={"username":b.config["client"],"password":b.password})
            page=ctx.new_page()
            page.goto(b.url+"/#skills")
            expect(page.get_by_text("Disabled",exact=True).first).to_be_visible()
            assert a.config["name"] not in page.locator("body").inner_text()
            browser.close()
        b.api("workos/approve",{})
        b.api("workos/measure",{"task":"measure-pilot","value":0,"reference":"birch-01"})
        result=b.api("workos/select",{"task":"measure-pilot","intent":"Could you check the latest reading against our goal?"})
        assert result["selected"] is None
        b.api("workos/run",{"task":"measure-pilot"},status=403)
        b.api("workos/cancel",{"task":"measure-pilot"})
        assert "birch-01" not in json.dumps(a.api("export"))
        assert "pilot-check-01" not in json.dumps(b.api("export"))
        decision=a.api("decisions")["decisions"][0]
        b.api("decisions/"+decision["id"],{"outcome":"test"},status=404)
        a.stop()
        a.config["name"]="Alder Updated"
        a.config["permissions"]=[]
        a.write_config()
        a.cli("update",a.file)
        a.start()
        assert a.api("bootstrap")["workspace"]["name"]=="Alder Updated"
        assert a.api("workos")["tasks"][0]["verified"]
        assert not a.api("workos")["catalogue"]["enabled"]
        a.stop()
        a.cli("rollback")
        a.start()
        assert a.api("bootstrap")["workspace"]["name"]=="Alder Studio"
        assert a.api("workos")["catalogue"]["enabled"]
        assert a.api("decisions")["decisions"][0]["outcome"]==decision["outcome"]
        migration_rehearsal(Path(temp),cleanup)
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM") or shutil.which("chromium") or None)
            direct_output_rehearsal(Path(temp),cleanup,browser)
            browser.close()
        if baseline:=os.environ.get("WORKOS_INDEPENDENT_BASELINE"):
            application_rehearsal(Path(temp),cleanup,baseline)
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM") or shutil.which("chromium") or None)
            exercise_planning(browser,a)
            navigation_rehearsal(browser,a)
            navigation_rehearsal(browser,b)
            named_account_rehearsal(Path(temp),cleanup,browser,b)
            browser.close()
        mcp_rehearsal(a,b)
        backup_rehearsal(Path(temp),a)
        a.cli("clear-usage")
        assert not a.api("workos")["usage"]["events"]
        assert a.api("workos/history?revision=1")["tasks"][0]["verified"]
        print("PASS: browser journeys, both clients, protected API, restart, config update/rollback and telemetry deletion",flush=True)

if __name__ == "__main__":
    main()
