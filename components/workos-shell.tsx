"use client";
import { useEffect, useState } from "react";
import { Load } from "./ui";
import { WorkspacePage, useApi } from "@/lib/client";
import { usePathname } from "@/lib/nav";
import { StarterPages } from "@/views/workos";

export function WorkOSShell() {
  const boot = useApi("bootstrap");
  const page = usePathname().slice(1);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return (
    <Load q={boot} skeleton={<p>Opening your WorkOS installation…</p>}>
      {(data) =>
        data.clientStarter ? (
          <WorkspacePage.Provider value={{ boot: data, toast: setNotice }}>
            <StarterPages page={page} />
            {notice && (
              <div role="status" aria-live="polite" className="workos-notice">
                {notice}
              </div>
            )}
          </WorkspacePage.Provider>
        ) : (
          <main>
            <h1>Unable to open this installation</h1>
          </main>
        )
      }
    </Load>
  );
}
