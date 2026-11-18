"use client";
// Navigation. The app is one page; the part after "#" says which screen is showing (#overview, #website, #room/verdict).
// These helpers have the same names as the Next.js ones, so a view can link and navigate without caring how it works.
import React, { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const read = () => "/" + (window.location.hash.replace(/^#\/?/, "") || "overview");

/** "/website" or "website" or "/" becomes "#website" or "#overview". */
export const toHash = (href: string) => "#" + (href.replace(/^[#/]+/, "").replace(/\/+$/, "") || "overview");
export function go(href: string) { window.location.hash = toHash(href); }

/** The current screen as a path, for example "/website" or "/brain/edit". */
export function usePathname() { return useSyncExternalStore(subscribe, read, () => "/overview"); }
export function useRouter() { return { push: go, replace: go }; }

export default function Link({ href, children, ...rest }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  return <a href={toHash(href)} {...rest}>{children}</a>;
}
