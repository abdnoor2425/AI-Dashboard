"use client";
// Metricool by file: for people whose Metricool plan has no API. Drop an export here, or let your AI save one into the folder.
import React, { useRef, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { Icon } from "./ui";

const ACCEPT = ".csv,.tsv,.txt,.xlsx,.json,.pdf";
export const fileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(new Error("That file could not be read."));
  r.readAsDataURL(file);
});

export function MetricoolFile({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const app = useApp();
  const q = useApi("social/file");
  const d = q.data;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const send = async (file?: File | null) => {
    if (!file || busy) return;
    setBusy(true); setError("");
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("That file is over 15 MB. Export a shorter date range.");
      await api("social/file", { method: "POST", body: { name: file.name, data: await fileAsBase64(file) } });
      app.toast("Metricool numbers added"); app.reloadBoot?.(); onDone?.();
    } catch (e: any) { setError(e.message); }
    setBusy(false); if (input.current) input.current.value = "";
  };
  const act = async (action: "open" | "remove") => { try { await api("social/file", { method: "POST", body: { action } }); if (action === "remove") { app.toast("Metricool file removed"); app.reloadBoot?.(); } } catch (e: any) { setError(e.message); } };
  const ask = d ? `Export my Metricool numbers for the last 30 days as a CSV with the columns date, network, followers, reach. Save it in this folder: ${d.folder}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(ask); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError("Select the text and copy it."); } };
  return (
    <div className={"mcf" + (compact ? " compact" : "")}>
      <div className={"mcf-drop" + (over ? " over" : "")} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]); }}>
        <Icon name="files" size={24} />
        <span className="mcf-words"><b>{busy ? "Reading the file" : "Drop a Metricool export here"}</b><small>CSV, Excel, JSON or PDF. No API plan needed.</small></span>
        <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? <span className="spinner" /> : null}Choose a file</button>
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => send(e.target.files?.[0])} aria-label="Choose a Metricool file" />
      </div>
      {error && <p className="mcf-note bad" role="alert">{error}</p>}
      {!error && d?.problem && <p className="mcf-note bad">The newest file in the folder, {d.problem.file}, could not be used: {d.problem.error}</p>}
      {d?.file && <div className="mcf-now"><span className="dot good" /><span style={{ flex: 1, minWidth: 0 }}><b>{d.file.name}</b><small>Read {ago(d.file.at)}{d.file.networks?.length ? ` · ${d.file.networks.join(", ")}` : ""}</small></span><button type="button" className="btn sm" onClick={() => act("remove")}>Remove</button></div>}
      {d && (
        <div className="mcf-ai">
          <span className="t-cap">Or let your AI keep it fresh</span>
          <p>Your AI saves a new export in this folder, and the dashboard shows the newest one.</p>
          <code className="mcf-path">{d.folder}</code>
          <div className="flex gap-2 flex-wrap"><button type="button" className="btn sm" onClick={copy}><Icon name={copied ? "check" : "files"} size={14} />{copied ? "Copied" : "Copy the request for your AI"}</button><button type="button" className="btn sm" onClick={() => act("open")}>Open the folder</button></div>
        </div>
      )}
    </div>
  );
}
