"use client";
// Every page has its own address: /website, /social, /goals and so on. "/" is Overview.
import { usePathname } from "next/navigation";
import { VIEWS } from "@/views";
import { pageOf } from "@/components/shell";
import { Empty } from "@/components/ui";

export default function Page() {
  const View = VIEWS[pageOf(usePathname())];
  return View ? <View /> : <div className="card"><Empty art="search" title="There is no page here"><p>Use the sidebar to pick a page.</p></Empty></div>;
}
