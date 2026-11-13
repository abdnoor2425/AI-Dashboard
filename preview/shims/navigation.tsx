import { useEffect, useState } from "react";
// "settings" is a reserved name on the preview host, so it is shown as #preferences there.
const ALIAS: Record<string, string> = { settings: "preferences" };
const BACK: Record<string, string> = { preferences: "settings" };
export const toHash = (href: string) => { const p = href.replace(/^\/+/, "").split("/")[0]; return "#" + (p ? ALIAS[p] || p : "overview"); };
const read = () => { const h = (typeof location !== "undefined" ? location.hash : "").replace(/^#/, ""); const p = BACK[h] || h; return !p || p === "overview" ? "/" : "/" + p; };
export function usePathname() {
  const [p, setP] = useState(read());
  useEffect(() => { const on = () => setP(read()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  return p;
}
export function useRouter() { return { push: (href: string) => { location.hash = toHash(href); }, replace: (href: string) => { location.hash = toHash(href); }, refresh: () => {} }; }
