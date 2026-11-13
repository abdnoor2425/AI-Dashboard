// Preview-only stand-in for next/link: pages live at plain #names so the hosted preview can route.
import React from "react";
import { toHash } from "./navigation";
export default function Link({ href, children, ...rest }: any) { return <a href={toHash(String(href))} {...rest}>{children}</a>; }
