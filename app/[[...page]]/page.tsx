"use client";
// The app is one page. An old address such as /website is sent to its screen (#website); the shell draws everything else.
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    const page = window.location.pathname.replace(/^\/+|\/+$/g, "");
    if (page) window.location.replace("/" + window.location.search + "#" + page);
  }, []);
  return null;
}
